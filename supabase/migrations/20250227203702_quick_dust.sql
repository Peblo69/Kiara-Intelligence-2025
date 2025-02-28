/*
  # Configure auth settings and email confirmation

  1. Changes
    - Add email confirmation columns
    - Update user metadata for email confirmation
    - Set up triggers for maintaining updated timestamps
*/

-- Add email confirmation columns if they don't exist
ALTER TABLE auth.users 
ADD COLUMN IF NOT EXISTS email_confirmed_at timestamptz;

-- Create function to update auth settings
CREATE OR REPLACE FUNCTION auth.update_auth_settings()
RETURNS void AS $$
BEGIN
  -- Update user raw_app_meta_data to require email confirmation
  UPDATE auth.users
  SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || 
    jsonb_build_object(
      'email_confirmed', CASE WHEN email_confirmed_at IS NOT NULL THEN true ELSE false END,
      'email_confirm_required', true,
      'reauthentication_required', true,
      'email_change_confirm_required', true
    ),
    updated_at = now()
  WHERE raw_app_meta_data IS NULL OR 
        NOT (raw_app_meta_data ? 'email_confirm_required');

  -- Reset email confirmation status for existing users that haven't confirmed
  UPDATE auth.users
  SET email_confirmed_at = NULL,
      updated_at = now()
  WHERE email_confirmed_at IS NOT NULL
    AND (raw_app_meta_data->>'email_confirmed')::boolean IS NOT TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Execute the function
SELECT auth.update_auth_settings();

-- Create trigger to maintain updated_at
CREATE OR REPLACE FUNCTION auth.update_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add trigger to auth.users
DROP TRIGGER IF EXISTS update_auth_users_updated_at ON auth.users;
CREATE TRIGGER update_auth_users_updated_at
  BEFORE UPDATE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION auth.update_updated_at();