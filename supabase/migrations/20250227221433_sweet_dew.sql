-- Drop email unique constraint from users table
ALTER TABLE public.users
DROP CONSTRAINT IF EXISTS users_email_key;

-- Create function to handle new user creation with retries
CREATE OR REPLACE FUNCTION auth.create_user_profile() 
RETURNS trigger 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql 
AS $$
DECLARE
  retries integer := 0;
  max_retries constant integer := 3;
  success boolean := false;
  initial_tokens constant integer := 80;
BEGIN
  -- First check if profile already exists
  IF EXISTS (SELECT 1 FROM public.users WHERE id = NEW.id) THEN
    RETURN NEW;
  END IF;

  WHILE retries < max_retries AND NOT success LOOP
    BEGIN
      -- Start transaction
      -- Create user profile with initial tokens
      INSERT INTO public.users (
        id,
        email,
        display_name,
        tokens_used,
        active_subscription,
        last_token_reset,
        created_at,
        updated_at
      ) VALUES (
        NEW.id,
        NEW.email,
        split_part(NEW.email, '@', 1),
        initial_tokens,
        'free',
        now(),
        NOW(),
        NOW()
      );

      -- Record initial token grant
      INSERT INTO token_transactions (
        user_id,
        amount,
        reason,
        metadata
      ) VALUES (
        NEW.id,
        initial_tokens,
        'bonus',
        jsonb_build_object(
          'type', 'initial_grant',
          'description', 'Initial token grant for new user'
        )
      );

      -- Initialize memory store
      INSERT INTO memory_stores (
        user_id,
        memory_count,
        last_processed
      ) VALUES (
        NEW.id,
        0,
        now()
      );

      -- Create preferences
      INSERT INTO public.preferences (
        user_id,
        theme,
        font_size,
        language,
        notifications,
        ai_preferences
      ) VALUES (
        NEW.id,
        'dark',
        14,
        'en',
        jsonb_build_object(
          'email', true,
          'push', true,
          'desktop', true
        ),
        jsonb_build_object(
          'defaultModel', 'dominator',
          'temperature', 0.7,
          'maxTokens', 2048
        )
      );

      -- Create quota settings
      INSERT INTO public.quotas (
        user_id,
        plan,
        limits,
        usage
      ) VALUES (
        NEW.id,
        'free',
        jsonb_build_object(
          'maxChats', 10,
          'maxTokensPerDay', 1000,
          'maxMemories', 50,
          'maxFileSize', 5242880
        ),
        jsonb_build_object(
          'currentTokens', initial_tokens
        )
      );

      success := true;
      EXIT;

    EXCEPTION 
      WHEN unique_violation THEN
        -- If it's a unique violation on the id, the profile already exists
        IF EXISTS (SELECT 1 FROM public.users WHERE id = NEW.id) THEN
          success := true;
          EXIT;
        END IF;
        -- Otherwise retry
        retries := retries + 1;
        IF retries < max_retries THEN
          PERFORM pg_sleep(0.1 * retries);
          CONTINUE;
        END IF;
      WHEN OTHERS THEN
        RAISE NOTICE 'Error creating user profile (attempt %): %', retries + 1, SQLERRM;
        retries := retries + 1;
        IF retries < max_retries THEN
          PERFORM pg_sleep(0.1 * retries);
        END IF;
    END;
  END LOOP;

  RETURN NEW;
END;
$$;

-- Function to safely get or create user profile
CREATE OR REPLACE FUNCTION public.get_or_create_user_profile(user_id uuid)
RETURNS SETOF users 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_profile users;
  initial_tokens constant integer := 80;
BEGIN
  -- First try to get existing profile
  SELECT * INTO v_profile
  FROM users 
  WHERE id = user_id;

  -- If profile exists, return it
  IF FOUND THEN
    RETURN NEXT v_profile;
    RETURN;
  END IF;

  -- Profile doesn't exist, create it
  INSERT INTO users (
    id,
    email,
    display_name,
    tokens_used,
    active_subscription,
    last_token_reset,
    created_at,
    updated_at
  )
  SELECT
    au.id,
    au.email,
    split_part(au.email, '@', 1),
    initial_tokens,
    'free',
    now(),
    NOW(),
    NOW()
  FROM auth.users au
  WHERE au.id = user_id
  RETURNING * INTO v_profile;

  -- Record initial token grant
  IF FOUND THEN
    INSERT INTO token_transactions (
      user_id,
      amount,
      reason,
      metadata
    ) VALUES (
      user_id,
      initial_tokens,
      'bonus',
      jsonb_build_object(
        'type', 'initial_grant',
        'description', 'Initial token grant for new user'
      )
    );
  END IF;

  RETURN NEXT v_profile;
  RETURN;
END;
$$;

-- Function to get user's current token balance
CREATE OR REPLACE FUNCTION get_user_token_balance(p_user_id uuid)
RETURNS jsonb AS $$
DECLARE
  v_user_data record;
  v_recent_transactions jsonb;
  v_time_until_reset interval;
  v_can_reset boolean;
BEGIN
  -- Get user data
  SELECT 
    u.tokens_used,
    u.active_subscription,
    u.last_token_reset,
    s.tier_id,
    s.current_period_end
  INTO v_user_data
  FROM users u
  LEFT JOIN user_subscriptions s ON s.user_id = u.id AND s.status = 'active'
  WHERE u.id = p_user_id;

  -- Check if user can get a token reset
  SELECT 
    CASE 
      WHEN v_user_data.tokens_used < 80 AND 
           (v_user_data.last_token_reset IS NULL OR 
            v_user_data.last_token_reset < now() - interval '24 hours')
      THEN true
      ELSE false
    END INTO v_can_reset;

  -- Calculate time until next reset
  IF v_user_data.last_token_reset IS NOT NULL THEN
    v_time_until_reset := greatest(
      (v_user_data.last_token_reset + interval '24 hours') - now(),
      interval '0'
    );
  ELSE
    v_time_until_reset := interval '0';
  END IF;

  -- Get recent transactions
  SELECT jsonb_agg(
    jsonb_build_object(
      'amount', t.amount,
      'reason', t.reason,
      'created_at', t.created_at
    )
    ORDER BY t.created_at DESC
  )
  INTO v_recent_transactions
  FROM (
    SELECT *
    FROM token_transactions
    WHERE user_id = p_user_id
    ORDER BY created_at DESC
    LIMIT 5
  ) t;

  RETURN jsonb_build_object(
    'current_balance', COALESCE(v_user_data.tokens_used, 0),
    'subscription_tier', v_user_data.active_subscription,
    'subscription_expires', v_user_data.current_period_end,
    'can_reset', v_can_reset,
    'time_until_reset', v_time_until_reset,
    'recent_transactions', COALESCE(v_recent_transactions, '[]'::jsonb)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION public.get_or_create_user_profile TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_token_balance TO authenticated;