-- Drop existing function if it exists
DROP FUNCTION IF EXISTS auth.create_user_profile CASCADE;

-- Create improved user profile creation function
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
        -- If it's a unique violation, check which table caused it
        RAISE NOTICE 'Unique violation occurred, retrying...';
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

-- Create trigger for user profile creation
DROP TRIGGER IF EXISTS create_user_profile ON auth.users;
CREATE TRIGGER create_user_profile
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION auth.create_user_profile();

-- Function to safely get or create user profile
CREATE OR REPLACE FUNCTION public.get_or_create_user_profile(user_id uuid)
RETURNS SETOF users 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- First try to get existing profile
  RETURN QUERY 
  SELECT * FROM users WHERE id = user_id;

  -- If no rows returned, create profile
  IF NOT FOUND THEN
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
      80, -- Initial tokens
      'free',
      now(),
      NOW(),
      NOW()
    FROM auth.users au
    WHERE au.id = user_id
    ON CONFLICT (id) DO UPDATE
    SET updated_at = now()
    RETURNING *;
  END IF;
END;
$$;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION public.get_or_create_user_profile TO authenticated;