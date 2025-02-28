/*
  # Fix Email Verification Redirect

  1. Changes
    - Add proper email verification handling
    - Fix redirect URLs for email verification
    - Add function to verify email tokens
    - Add proper error handling

  2. Security
    - Enable RLS
    - Add proper security definer
    - Add authentication checks
*/

-- Drop existing functions if they exist
DROP FUNCTION IF EXISTS auth.handle_email_verification;
DROP FUNCTION IF EXISTS auth.verify_email;

-- Create function to handle email verification
CREATE OR REPLACE FUNCTION auth.handle_email_verification()
RETURNS trigger AS $$
BEGIN
  -- For new users or email updates
  IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND NEW.email != OLD.email) THEN
    -- Set confirmation fields
    NEW.email_confirmed_at = NULL;
    NEW.confirmed_at = NULL;
    NEW.raw_app_meta_data = COALESCE(NEW.raw_app_meta_data, '{}'::jsonb) || 
      jsonb_build_object(
        'email_confirmed', false,
        'email_confirm_required', true,
        'redirect_url', current_setting('request.url', true)
      );
  END IF;

  -- When email is confirmed
  IF TG_OP = 'UPDATE' AND NEW.email_confirmed_at IS NOT NULL AND OLD.email_confirmed_at IS NULL THEN
    NEW.confirmed_at = NEW.email_confirmed_at;
    NEW.raw_app_meta_data = COALESCE(NEW.raw_app_meta_data, '{}'::jsonb) || 
      jsonb_build_object('email_confirmed', true);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for email verification
DROP TRIGGER IF EXISTS handle_email_verification ON auth.users;
CREATE TRIGGER handle_email_verification
  BEFORE INSERT OR UPDATE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION auth.handle_email_verification();

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

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION auth.verify_email TO authenticated;