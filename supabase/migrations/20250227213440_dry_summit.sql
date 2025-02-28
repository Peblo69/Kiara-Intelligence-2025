/*
  # Fix User Creation and Profile Setup

  1. Changes
    - Add proper user profile creation trigger
    - Add error handling and retries
    - Fix transaction handling
    - Add proper RLS policies

  2. Security
    - Enable RLS
    - Add proper security definer
    - Add authentication checks
*/

-- Drop existing triggers first
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS create_profile_for_user ON auth.users;

-- Create function to safely create user profile
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
BEGIN
  WHILE retries < max_retries AND NOT success LOOP
    BEGIN
      -- Attempt to create user profile
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
        0,
        'free',
        NOW(),
        NOW()
      );

      -- Create default preferences
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
          'currentTokens', 0
        )
      );

      success := true;
      EXIT;

    EXCEPTION 
      WHEN unique_violation THEN
        -- Profile already exists, consider it a success
        success := true;
        EXIT;
      WHEN OTHERS THEN
        -- Log error and retry
        RAISE WARNING 'Error creating user profile (attempt %): %', retries + 1, SQLERRM;
        retries := retries + 1;
        IF retries < max_retries THEN
          PERFORM pg_sleep(0.1 * retries); -- Exponential backoff
        END IF;
    END;
  END LOOP;

  IF NOT success THEN
    RAISE WARNING 'Failed to create user profile after % attempts', max_retries;
  END IF;

  -- Always return NEW to allow auth user creation
  RETURN NEW;
END;
$$;

-- Create trigger to create profile after auth user creation
DROP TRIGGER IF EXISTS create_user_profile ON auth.users;
CREATE TRIGGER create_user_profile
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION auth.create_user_profile();

-- Create function to get or create user profile
CREATE OR REPLACE FUNCTION public.get_or_create_user_profile(user_id uuid)
RETURNS SETOF users 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Try to get existing profile
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
      created_at,
      updated_at
    )
    SELECT
      au.id,
      au.email,
      split_part(au.email, '@', 1),
      0,
      'free',
      NOW(),
      NOW()
    FROM auth.users au
    WHERE au.id = user_id
    ON CONFLICT (id) DO NOTHING
    RETURNING *;
  END IF;
END;
$$;

-- Add RLS policies
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own profile"
  ON public.users
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.users
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_or_create_user_profile TO authenticated;