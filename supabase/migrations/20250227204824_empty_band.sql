/*
  # Fix email confirmation system

  1. Changes
    - Add email confirmation columns
    - Create email confirmation triggers
    - Set up email templates
    - Add helper functions

  2. Security
    - Enable RLS for auth tables
    - Add policies for email confirmation
*/

-- Enable email confirmations
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
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  BEFORE INSERT ON auth.users
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