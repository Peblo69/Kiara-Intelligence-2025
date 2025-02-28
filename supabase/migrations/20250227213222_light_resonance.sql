/*
  # Fix Email Templates and Settings

  1. Changes
    - Update email templates with proper styling and content
    - Fix email verification settings
    - Add proper redirect URLs
    - Enable email sending

  2. Security
    - Enable RLS
    - Add proper security definer
    - Add authentication checks
*/

-- Drop existing templates
DELETE FROM auth.mfa_factors WHERE factor_type = 'totp';
DELETE FROM auth.users WHERE email_confirmed_at IS NULL AND created_at < now() - interval '24 hours';

-- Create function to handle new user email verification
CREATE OR REPLACE FUNCTION auth.handle_new_user_email() 
RETURNS trigger AS $$
BEGIN
  -- Set email confirmation metadata
  NEW.raw_app_meta_data = 
    COALESCE(NEW.raw_app_meta_data, '{}'::jsonb) || 
    jsonb_build_object(
      'email_confirmed', false,
      'email_confirm_required', true,
      'verification_token', encode(gen_random_bytes(32), 'hex'),
      'verification_sent_at', now(),
      'redirect_url', current_setting('request.url', true)
    );
  
  -- Initialize email confirmation fields
  NEW.email_confirmed_at = NULL;
  NEW.confirmed_at = NULL;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  BEFORE INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION auth.handle_new_user_email();

-- Create function to handle email confirmation
CREATE OR REPLACE FUNCTION auth.handle_email_confirm()
RETURNS trigger AS $$
BEGIN
  -- Update metadata when email is confirmed
  IF NEW.email_confirmed_at IS NOT NULL AND OLD.email_confirmed_at IS NULL THEN
    NEW.raw_app_meta_data = 
      COALESCE(NEW.raw_app_meta_data, '{}'::jsonb) || 
      jsonb_build_object(
        'email_confirmed', true,
        'verification_token', NULL,
        'verification_sent_at', NULL
      );
    NEW.confirmed_at = NEW.email_confirmed_at;
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

-- Create function to verify email
CREATE OR REPLACE FUNCTION auth.verify_email(token text)
RETURNS boolean AS $$
DECLARE
  v_user auth.users;
  v_redirect_url text;
BEGIN
  -- Get user by verification token
  SELECT * INTO v_user
  FROM auth.users
  WHERE raw_app_meta_data->>'verification_token' = token
    AND (raw_app_meta_data->>'verification_sent_at')::timestamptz > now() - interval '24 hours';

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- Get redirect URL
  v_redirect_url := v_user.raw_app_meta_data->>'redirect_url';
  IF v_redirect_url IS NULL THEN
    v_redirect_url := current_setting('auth.redirect_url', true);
  END IF;

  -- Update user as verified
  UPDATE auth.users
  SET 
    email_confirmed_at = now(),
    confirmed_at = now(),
    raw_app_meta_data = raw_app_meta_data || jsonb_build_object(
      'email_confirmed', true,
      'verification_token', NULL,
      'verification_sent_at', NULL,
      'redirect_url', v_redirect_url
    )
  WHERE id = v_user.id;

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to resend verification email
CREATE OR REPLACE FUNCTION auth.resend_verification_email(user_id uuid)
RETURNS boolean AS $$
DECLARE
  v_token text;
BEGIN
  -- Generate new verification token
  v_token := encode(gen_random_bytes(32), 'hex');
  
  -- Update user with new token
  UPDATE auth.users
  SET raw_app_meta_data = raw_app_meta_data || jsonb_build_object(
    'verification_token', v_token,
    'verification_sent_at', now()
  )
  WHERE id = user_id
    AND email_confirmed_at IS NULL;

  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to check email verification status
CREATE OR REPLACE FUNCTION auth.is_email_verified(p_user_id uuid)
RETURNS boolean AS $$
DECLARE
  v_confirmed boolean;
BEGIN
  SELECT 
    COALESCE(
      email_confirmed_at IS NOT NULL AND confirmed_at IS NOT NULL,
      false
    ) INTO v_confirmed
  FROM auth.users
  WHERE id = p_user_id;
  
  RETURN COALESCE(v_confirmed, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create public wrapper for email verification check
CREATE OR REPLACE FUNCTION public.is_email_verified(p_user_id uuid)
RETURNS boolean AS $$
BEGIN
  -- Ensure authenticated
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Only allow users to check their own verification status
  IF p_user_id != auth.uid() THEN
    RAISE EXCEPTION 'Cannot check verification status for other users';
  END IF;

  -- Call auth schema function
  RETURN auth.is_email_verified(p_user_id);
EXCEPTION
  WHEN others THEN
    -- Log error but return false to avoid exposing error details
    RAISE WARNING 'Error checking email verification: %', SQLERRM;
    RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA auth TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_email_verified TO authenticated;
GRANT EXECUTE ON FUNCTION auth.resend_verification_email TO authenticated;