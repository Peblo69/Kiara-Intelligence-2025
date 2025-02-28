/*
  # Fix user creation and email confirmation

  1. Changes
    - Add user creation trigger
    - Add email confirmation handling
    - Add user profile creation
    - Add proper error handling

  2. Security
    - Enable RLS for auth tables
    - Add policies for user access
*/

-- Create function to handle new user creation
CREATE OR REPLACE FUNCTION auth.handle_new_user() 
RETURNS trigger AS $$
BEGIN
  -- Set email confirmation metadata
  NEW.raw_app_meta_data = 
    COALESCE(NEW.raw_app_meta_data, '{}'::jsonb) || 
    jsonb_build_object(
      'email_confirmed', false,
      'email_confirm_required', true
    );
  
  -- Initialize email confirmation fields
  NEW.email_confirmed_at = NULL;
  NEW.confirmed_at = NULL;

  -- Create user profile
  INSERT INTO public.users (
    id,
    email,
    display_name,
    tokens_used,
    active_subscription
  ) VALUES (
    NEW.id,
    NEW.email,
    split_part(NEW.email, '@', 1),
    0,
    'free'
  );
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error details
    RAISE NOTICE 'Error in handle_new_user: %', SQLERRM;
    -- Still return NEW to allow user creation
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION auth.handle_new_user();

-- Create function to handle email confirmation
CREATE OR REPLACE FUNCTION auth.handle_email_confirm()
RETURNS trigger AS $$
BEGIN
  -- Update metadata when email is confirmed
  IF NEW.email_confirmed_at IS NOT NULL AND OLD.email_confirmed_at IS NULL THEN
    NEW.raw_app_meta_data = 
      COALESCE(NEW.raw_app_meta_data, '{}'::jsonb) || 
      jsonb_build_object('email_confirmed', true);
    NEW.confirmed_at = NEW.email_confirmed_at;

    -- Update user profile
    UPDATE public.users
    SET updated_at = now()
    WHERE id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for email confirmation
DROP TRIGGER IF EXISTS on_auth_user_email_confirmed ON auth.users;
CREATE TRIGGER on_auth_user_email_confirmed
  BEFORE UPDATE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION auth.handle_email_confirm();

-- Create function to check email confirmation status
CREATE OR REPLACE FUNCTION auth.is_email_confirmed(user_id uuid)
RETURNS boolean AS $$
DECLARE
  v_confirmed boolean;
BEGIN
  SELECT 
    COALESCE(
      (raw_app_meta_data->>'email_confirmed')::boolean,
      false
    ) INTO v_confirmed
  FROM auth.users
  WHERE id = user_id;
  
  RETURN COALESCE(v_confirmed, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to safely create user profile
CREATE OR REPLACE FUNCTION auth.ensure_user_profile()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.users (
    id,
    email,
    display_name,
    tokens_used,
    active_subscription
  )
  VALUES (
    NEW.id,
    NEW.email,
    split_part(NEW.email, '@', 1),
    0,
    'free'
  )
  ON CONFLICT (id) DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for ensuring user profile
DROP TRIGGER IF EXISTS ensure_user_profile ON auth.users;
CREATE TRIGGER ensure_user_profile
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION auth.ensure_user_profile();

-- Grant necessary permissions
GRANT USAGE ON SCHEMA auth TO authenticated;
GRANT EXECUTE ON FUNCTION auth.is_email_confirmed TO authenticated;

-- Enable RLS
ALTER TABLE auth.users ENABLE ROW LEVEL SECURITY;

-- Add RLS policies
CREATE POLICY "Users can view own auth data"
  ON auth.users
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own auth data"
  ON auth.users
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);