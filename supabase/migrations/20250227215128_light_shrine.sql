/*
  # Token Management System

  1. Changes
    - Add initial token balance (80) for new users
    - Add daily token reset function
    - Add token transaction tracking

  2. Features
    - New users get 80 tokens on signup
    - Daily reset of tokens to 80 for users with less than 80 tokens
    - Transaction history for auditing
*/

-- Modify user profile creation to include initial tokens
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
      -- Attempt to create user profile with initial tokens
      INSERT INTO public.users (
        id,
        email,
        display_name,
        tokens_used,
        active_subscription,
        created_at,
        updated_at
      ) VALUES (
        NEW.id,
        NEW.email,
        split_part(NEW.email, '@', 1),
        initial_tokens, -- Set initial tokens to 80
        'free',
        NOW(),
        NOW()
      );

      -- Create initial token transaction record
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

      -- Rest of the profile creation remains the same
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

-- Function to reset tokens daily
CREATE OR REPLACE FUNCTION reset_low_tokens()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  target_tokens constant integer := 80;
  v_user record;
BEGIN
  -- Find users with less than target tokens
  FOR v_user IN 
    SELECT id, tokens_used 
    FROM public.users 
    WHERE tokens_used < target_tokens
  LOOP
    -- Calculate tokens to add
    DECLARE
      tokens_to_add integer := target_tokens - v_user.tokens_used;
    BEGIN
      -- Update user tokens
      UPDATE public.users
      SET tokens_used = target_tokens,
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
          'previous_balance', v_user.tokens_used
        )
      );
    END;
  END LOOP;
END;
$$;

-- Create function to check and reset tokens if needed
CREATE OR REPLACE FUNCTION check_and_reset_tokens()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  last_reset timestamptz;
BEGIN
  -- Get last reset time from settings
  SELECT value->>'last_reset'
  INTO last_reset
  FROM admin_settings
  WHERE key = 'token_reset'
  LIMIT 1;

  -- If no last reset or it was more than 24 hours ago
  IF last_reset IS NULL OR last_reset < now() - interval '24 hours' THEN
    -- Perform token reset
    PERFORM reset_low_tokens();

    -- Update last reset time
    INSERT INTO admin_settings (key, value)
    VALUES (
      'token_reset',
      jsonb_build_object('last_reset', now())
    )
    ON CONFLICT (key)
    DO UPDATE SET value = jsonb_build_object('last_reset', now());
  END IF;
END;
$$;

-- Update existing users to have minimum 80 tokens
UPDATE public.users
SET tokens_used = 80,
    updated_at = now()
WHERE tokens_used < 80;

-- Insert token transactions for updated users
INSERT INTO token_transactions (
  user_id,
  amount,
  reason,
  metadata
)
SELECT 
  id,
  80 - tokens_used,
  'bonus',
  jsonb_build_object(
    'type', 'initial_grant',
    'description', 'Initial token grant for existing user'
  )
FROM public.users
WHERE tokens_used < 80;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION reset_low_tokens TO postgres;
GRANT EXECUTE ON FUNCTION check_and_reset_tokens TO postgres;

-- Create trigger to check tokens on user activity
CREATE OR REPLACE FUNCTION check_tokens_on_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM check_and_reset_tokens();
  RETURN NEW;
END;
$$;

-- Add trigger to check tokens when users table is accessed
CREATE TRIGGER check_tokens_trigger
  BEFORE UPDATE ON public.users
  FOR EACH STATEMENT
  EXECUTE FUNCTION check_tokens_on_activity();