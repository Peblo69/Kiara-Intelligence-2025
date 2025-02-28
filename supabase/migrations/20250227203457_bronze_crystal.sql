/*
  # Add email templates for authentication

  1. Email Templates
    - Confirmation email for signup
    - Password reset email
    - Email change confirmation
    - Magic link email
    - Reauthentication email

  2. Changes
    - Add email templates with proper variables
    - Set up email subjects and content
*/

-- Create email templates table if it doesn't exist
CREATE TABLE IF NOT EXISTS auth.email_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_type text NOT NULL,
  subject text NOT NULL,
  content text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Function to update email templates
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

  -- Magic link email
  INSERT INTO auth.email_templates (template_type, subject, content)
  VALUES (
    'magic_link',
    'Your Kiara Intelligence Login Link',
    '<!DOCTYPE html>
    <html>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
      <h2>Login to Kiara Intelligence</h2>
      <p>Click the link below to log in:</p>
      <p>
        <a href="{{ .ConfirmationURL }}" style="background-color: #6b21a8; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">
          Log In
        </a>
      </p>
      <p>Or copy and paste this URL into your browser:</p>
      <p style="word-break: break-all;">{{ .ConfirmationURL }}</p>
      <p>This link will expire in 24 hours.</p>
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

-- Create unique constraint on template_type
ALTER TABLE auth.email_templates 
ADD CONSTRAINT email_templates_template_type_key UNIQUE (template_type);

-- Execute the function to set up templates
SELECT auth.update_email_templates();