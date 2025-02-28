/*
  # Token Reset Logic Update

  1. Changes
    - Add last_token_reset column to track when users last received tokens
    - Only reset tokens after 24 hours have passed
    - Keep initial 80 tokens for new users
    - No automatic reset on activity

  2. Features
    - Users get 80 tokens on signup
    - Tokens only reset after 24 hours if below 80
    - Must wait full 24 hours between resets
*/

-- Add last_token_reset column to users table
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS last_token_reset timestamptz DEFAULT now();

-- Drop old activity-based trigger if it exists
DROP TRIGGER IF EXISTS check_tokens_trigger ON public.users;
DROP FUNCTION IF EXISTS check_tokens_on_activity CASCADE;

-- Create improved token reset function
CREATE OR REPLACE FUNCTION reset_low_tokens()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  target_tokens constant integer := 80;
  v_user record;
BEGIN
  -- Find users with less than target tokens AND last reset over 24 hours ago
  FOR v_user IN 
    SELECT id, tokens_used, last_token_reset
    FROM public.users 
    WHERE tokens_used < target_tokens
    AND (last_token_reset IS NULL OR last_token_reset < now() - interval '24 hours')
  LOOP
    -- Calculate tokens to add
    DECLARE
      tokens_to_add integer := target_tokens - v_user.tokens_used;
    BEGIN
      -- Update user tokens and reset time
      UPDATE public.users
      SET 
        tokens_used = target_tokens,
        last_token_reset = now(),
        updated_at = now()
      WHERE id = v_user.id;

      -- Record token transaction
      INSERT INTO token_transactions (
        user_id,
        amount,
        reason,
        metadata
      ) VALUES (
        v_user.id,
        tokens_to_add,
        'bonus',
        jsonb_build_object(
          'type', 'daily_reset',
          'description', 'Daily token reset to 80',
          'previous_balance', v_user.tokens_used,
          'hours_since_last_reset', 
            EXTRACT(EPOCH FROM (now() - COALESCE(v_user.last_token_reset, now() - interval '48 hours'))) / 3600
        )
      );
    END;
  END LOOP;
END;
$$;

-- Function to check if user can get token reset
CREATE OR REPLACE FUNCTION can_reset_tokens(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_last_reset timestamptz;
  v_tokens integer;
BEGIN
  -- Get user's last reset time and current tokens
  SELECT last_token_reset, tokens_used
  INTO v_last_reset, v_tokens
  FROM public.users
  WHERE id = p_user_id;

  -- Can reset if:
  -- 1. Tokens are below 80
  -- 2. Last reset was more than 24 hours ago (or never reset)
  RETURN v_tokens < 80 AND 
         (v_last_reset IS NULL OR v_last_reset < now() - interval '24 hours');
END;
$$;

-- Function to get time until next reset
CREATE OR REPLACE FUNCTION get_time_until_reset(p_user_id uuid)
RETURNS interval
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_last_reset timestamptz;
BEGIN
  -- Get user's last reset time
  SELECT last_token_reset
  INTO v_last_reset
  FROM public.users
  WHERE id = p_user_id;

  -- If never reset, can reset immediately
  IF v_last_reset IS NULL THEN
    RETURN interval '0';
  END IF;

  -- Calculate time until next reset
  RETURN greatest(
    (v_last_reset + interval '24 hours') - now(),
    interval '0'
  );
END;
$$;

-- Update user profile creation to include last_token_reset
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
  WHILE retries < max_retries AND NOT success LOOP
    BEGIN
      -- Create user profile with initial tokens and reset time
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
        now(), -- Set initial reset time
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
        success := true;
        EXIT;
      WHEN OTHERS THEN
        RAISE WARNING 'Error creating user profile (attempt %): %', retries + 1, SQLERRM;
        retries := retries + 1;
        IF retries < max_retries THEN
          PERFORM pg_sleep(0.1 * retries);
        END IF;
    END;
  END LOOP;

  RETURN NEW;
END;
$$;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION can_reset_tokens TO authenticated;
GRANT EXECUTE ON FUNCTION get_time_until_reset TO authenticated;