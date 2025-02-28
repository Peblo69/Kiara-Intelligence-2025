-- Enable email confirmations
ALTER TABLE auth.users 
ADD COLUMN IF NOT EXISTS email_confirmed_at timestamptz,
ADD COLUMN IF NOT EXISTS confirmation_token text,
ADD COLUMN IF NOT EXISTS confirmation_sent_at timestamptz,
ADD COLUMN IF NOT EXISTS recovery_token text,
ADD COLUMN IF NOT EXISTS recovery_sent_at timestamptz,
ADD COLUMN IF NOT EXISTS email_change_token text,
ADD COLUMN IF NOT EXISTS email_change text,
ADD COLUMN IF NOT EXISTS email_change_sent_at timestamptz;

-- Create function to handle email confirmation
CREATE OR REPLACE FUNCTION auth.handle_email_confirmation()
RETURNS trigger AS $$
BEGIN
  -- For new users, set confirmation token and mark as unconfirmed
  IF TG_OP = 'INSERT' THEN
    NEW.email_confirmed_at = NULL;
    NEW.confirmation_token = encode(gen_random_bytes(32), 'hex');
    NEW.confirmation_sent_at = now();
    NEW.raw_app_meta_data = COALESCE(NEW.raw_app_meta_data, '{}'::jsonb) || 
      jsonb_build_object(
        'email_confirmed', false,
        'email_confirm_required', true
      );
  END IF;

  -- For email updates, require new confirmation
  IF TG_OP = 'UPDATE' AND NEW.email != OLD.email THEN
    NEW.email_confirmed_at = NULL;
    NEW.email_change_token = encode(gen_random_bytes(32), 'hex');
    NEW.email_change = NEW.email;
    NEW.email_change_sent_at = now();
    NEW.email = OLD.email;
    NEW.raw_app_meta_data = COALESCE(NEW.raw_app_meta_data, '{}'::jsonb) || 
      jsonb_build_object(
        'email_confirmed', false,
        'email_confirm_required', true
      );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for email confirmation
DROP TRIGGER IF EXISTS handle_email_confirmation ON auth.users;
CREATE TRIGGER handle_email_confirmation
  BEFORE INSERT OR UPDATE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION auth.handle_email_confirmation();

-- Create function to confirm email
CREATE OR REPLACE FUNCTION auth.confirm_email(token text)
RETURNS boolean AS $$
DECLARE
  v_user auth.users;
BEGIN
  -- Find user by confirmation token
  SELECT * INTO v_user
  FROM auth.users
  WHERE confirmation_token = token
    AND confirmation_sent_at > now() - interval '24 hours';

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- Update user as confirmed
  UPDATE auth.users
  SET 
    email_confirmed_at = now(),
    confirmation_token = NULL,
    raw_app_meta_data = raw_app_meta_data || 
      jsonb_build_object('email_confirmed', true)
  WHERE id = v_user.id;

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;