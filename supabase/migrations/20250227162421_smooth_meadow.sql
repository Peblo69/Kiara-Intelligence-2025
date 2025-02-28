-- Enable pgcrypto for encryption
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Create 2FA table
CREATE TABLE IF NOT EXISTS user_2fa (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  secret text NOT NULL,
  backup_codes text[] NOT NULL,
  enabled boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE user_2fa ENABLE ROW LEVEL SECURITY;

-- Add RLS policies
CREATE POLICY "Users can manage their own 2FA"
  ON user_2fa
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid());

-- Function to generate backup codes
CREATE OR REPLACE FUNCTION generate_backup_codes(count integer DEFAULT 8)
RETURNS text[] AS $$
DECLARE
  codes text[];
  i integer;
BEGIN
  FOR i IN 1..count LOOP
    codes[i] := encode(gen_random_bytes(5), 'hex');
  END LOOP;
  RETURN codes;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to setup 2FA
CREATE OR REPLACE FUNCTION setup_2fa(
  p_secret text
)
RETURNS jsonb AS $$
DECLARE
  backup_codes text[];
BEGIN
  -- Generate backup codes
  backup_codes := generate_backup_codes();

  -- Create or update 2FA settings
  INSERT INTO user_2fa (
    user_id,
    secret,
    backup_codes,
    enabled
  )
  VALUES (
    auth.uid(),
    pgp_sym_encrypt(p_secret, current_setting('app.jwt_secret')),
    backup_codes,
    false
  )
  ON CONFLICT (user_id)
  DO UPDATE SET
    secret = pgp_sym_encrypt(p_secret, current_setting('app.jwt_secret')),
    backup_codes = backup_codes,
    updated_at = now();

  -- Return backup codes to show to user
  RETURN jsonb_build_object(
    'backup_codes', backup_codes
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to enable 2FA
CREATE OR REPLACE FUNCTION enable_2fa(
  p_code text
)
RETURNS boolean AS $$
DECLARE
  v_secret text;
  v_valid boolean;
BEGIN
  -- Get user's secret
  SELECT pgp_sym_decrypt(secret::bytea, current_setting('app.jwt_secret'))
  INTO v_secret
  FROM user_2fa
  WHERE user_id = auth.uid();

  -- Verify code
  v_valid := verify_totp(v_secret, p_code);

  IF v_valid THEN
    -- Enable 2FA
    UPDATE user_2fa
    SET enabled = true,
        updated_at = now()
    WHERE user_id = auth.uid();
    RETURN true;
  END IF;

  RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to verify TOTP code
CREATE OR REPLACE FUNCTION verify_2fa(
  p_code text
)
RETURNS boolean AS $$
DECLARE
  v_secret text;
  v_backup_codes text[];
BEGIN
  -- Get user's 2FA settings
  SELECT 
    pgp_sym_decrypt(secret::bytea, current_setting('app.jwt_secret')),
    backup_codes
  INTO v_secret, v_backup_codes
  FROM user_2fa
  WHERE user_id = auth.uid()
    AND enabled = true;

  -- Check if code matches TOTP
  IF verify_totp(v_secret, p_code) THEN
    RETURN true;
  END IF;

  -- Check if code matches a backup code
  IF p_code = ANY(v_backup_codes) THEN
    -- Remove used backup code
    UPDATE user_2fa
    SET backup_codes = array_remove(backup_codes, p_code),
        updated_at = now()
    WHERE user_id = auth.uid();
    RETURN true;
  END IF;

  RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to disable 2FA
CREATE OR REPLACE FUNCTION disable_2fa()
RETURNS void AS $$
BEGIN
  UPDATE user_2fa
  SET enabled = false,
      updated_at = now()
  WHERE user_id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if 2FA is enabled
CREATE OR REPLACE FUNCTION is_2fa_enabled()
RETURNS boolean AS $$
DECLARE
  v_enabled boolean;
BEGIN
  SELECT enabled INTO v_enabled
  FROM user_2fa
  WHERE user_id = auth.uid();
  
  RETURN COALESCE(v_enabled, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION setup_2fa TO authenticated;
GRANT EXECUTE ON FUNCTION enable_2fa TO authenticated;
GRANT EXECUTE ON FUNCTION verify_2fa TO authenticated;
GRANT EXECUTE ON FUNCTION disable_2fa TO authenticated;
GRANT EXECUTE ON FUNCTION is_2fa_enabled TO authenticated;