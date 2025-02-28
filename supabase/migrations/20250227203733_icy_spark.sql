/*
  # Set up auth settings and email templates

  1. Changes
    - Add email confirmation settings
    - Configure email templates for auth flows
    - Set up triggers for maintaining timestamps
*/

-- Add email confirmation columns if they don't exist
ALTER TABLE auth.users 
ADD COLUMN IF NOT EXISTS email_confirmed_at timestamptz;

-- Create email templates table
CREATE TABLE IF NOT EXISTS auth.email_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_type text NOT NULL UNIQUE,
  subject text NOT NULL,
  content text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create function to update email templates
CREATE OR REPLACE FUNCTION auth.update_email_templates()
RETURNS void AS $$
BEGIN
  -- Signup confirmation email
  INSERT INTO auth.email_templates (template_type, subject, content)
  VALUES (
    'confirm_signup',
    'Welcome to Kiara Intelligence - Confirm Your Email',
    '<!DOCTYPE html>
    <html>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
      <h2>Welcome to Kiara Intelligence!</h2>
      <p>Please confirm your email address by clicking the link below:</p>
      <p>
        <a href="{{ .ConfirmationURL }}" style="background-color: #6b21a8; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">
          Confirm Email Address
        </a>
      </p>
      <p>Or copy and paste this URL into your browser:</p>
      <p style="word-break: break-all;">{{ .ConfirmationURL }}</p>
      <p>If you did not sign up for Kiara Intelligence, please ignore this email.</p>
    </body>
    </html>'
  )
  ON CONFLICT (template_type) DO UPDATE
  SET subject = EXCLUDED.subject,
      content = EXCLUDED.content,
      updated_at = now();

  -- Password reset email
  INSERT INTO auth.email_templates (template_type, subject, content)
  VALUES (
    'reset_password',
    'Reset Your Kiara Intelligence Password',
    '<!DOCTYPE html>
    <html>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
      <h2>Reset Your Password</h2>
      <p>Click the link below to reset your password:</p>
      <p>
        <a href="{{ .ConfirmationURL }}" style="background-color: #6b21a8; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">
          Reset Password
        </a>
      </p>
      <p>Or copy and paste this URL into your browser:</p>
      <p style="word-break: break-all;">{{ .ConfirmationURL }}</p>
      <p>If you did not request a password reset, please ignore this email.</p>
    </body>
    </html>'
  )
  ON CONFLICT (template_type) DO UPDATE
  SET subject = EXCLUDED.subject,
      content = EXCLUDED.content,
      updated_at = now();

  -- Email change confirmation
  INSERT INTO auth.email_templates (template_type, subject, content)
  VALUES (
    'change_email',
    'Confirm Your New Email Address',
    '<!DOCTYPE html>
    <html>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
      <h2>Confirm Email Change</h2>
      <p>Click the link below to confirm your new email address:</p>
      <p>
        <a href="{{ .ConfirmationURL }}" style="background-color: #6b21a8; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">
          Confirm New Email
        </a>
      </p>
      <p>Or copy and paste this URL into your browser:</p>
      <p style="word-break: break-all;">{{ .ConfirmationURL }}</p>
      <p>If you did not request this change, please contact support immediately.</p>
    </body>
    </html>'
  )
  ON CONFLICT (template_type) DO UPDATE
  SET subject = EXCLUDED.subject,
      content = EXCLUDED.content,
      updated_at = now();

  -- Reauthentication email
  INSERT INTO auth.email_templates (template_type, subject, content)
  VALUES (
    'confirm_identity',
    'Confirm Your Identity',
    '<!DOCTYPE html>
    <html>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
      <h2>Confirm Your Identity</h2>
      <p>Your confirmation code is:</p>
      <p style="font-size: 24px; font-weight: bold; letter-spacing: 2px; text-align: center; padding: 12px; background: #f0f0f0; border-radius: 4px;">
        {{ .Token }}
      </p>
      <p>This code will expire in 5 minutes.</p>
      <p>If you did not request this code, please ignore this email.</p>
    </body>
    </html>'
  )
  ON CONFLICT (template_type) DO UPDATE
  SET subject = EXCLUDED.subject,
      content = EXCLUDED.content,
      updated_at = now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

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

-- Add trigger to auth.email_templates
DROP TRIGGER IF EXISTS update_email_templates_updated_at ON auth.email_templates;
CREATE TRIGGER update_email_templates_updated_at
  BEFORE UPDATE ON auth.email_templates
  FOR EACH ROW
  EXECUTE FUNCTION auth.update_updated_at();

-- Execute the functions to set up templates and settings
SELECT auth.update_email_templates();
SELECT auth.update_auth_settings();