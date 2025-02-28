-- Create password reset table
CREATE TABLE IF NOT EXISTS auth.password_resets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  token text NOT NULL,
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  CONSTRAINT unique_active_token UNIQUE (user_id, token)
);

-- Create index for faster token lookups
CREATE INDEX IF NOT EXISTS idx_password_resets_token ON auth.password_resets(token);
CREATE INDEX IF NOT EXISTS idx_password_resets_user_id ON auth.password_resets(user_id);
CREATE INDEX IF NOT EXISTS idx_password_resets_expires_at ON auth.password_resets(expires_at);

-- Function to generate secure reset token
CREATE OR REPLACE FUNCTION auth.generate_reset_token(p_user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_token text;
BEGIN
  -- Generate secure token
  v_token := encode(gen_random_bytes(32), 'hex');
  
  -- Store token with 24-hour expiry
  INSERT INTO auth.password_resets (
    user_id,
    token,
    expires_at
  )
  VALUES (
    p_user_id,
    v_token,
    now() + interval '24 hours'
  );
  
  RETURN v_token;
END;
$$;

-- Function to validate reset token
CREATE OR REPLACE FUNCTION auth.check_reset_token(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid;
  v_email text;
BEGIN
  -- Get user info from valid token
  SELECT pr.user_id, u.email
  INTO v_user_id, v_email
  FROM auth.password_resets pr
  JOIN auth.users u ON u.id = pr.user_id
  WHERE pr.token = p_token
    AND pr.used_at IS NULL
    AND pr.expires_at > now();
    
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'valid', false,
      'error', 'Invalid or expired reset token'
    );
  END IF;
  
  RETURN jsonb_build_object(
    'valid', true,
    'user_id', v_user_id,
    'email', v_email
  );
END;
$$;

-- Function to complete password reset
CREATE OR REPLACE FUNCTION auth.complete_password_reset(
  p_token text,
  p_new_password text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  -- Get and validate token
  SELECT user_id INTO v_user_id
  FROM auth.password_resets
  WHERE token = p_token
    AND used_at IS NULL
    AND expires_at > now();
    
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  
  -- Mark token as used
  UPDATE auth.password_resets
  SET used_at = now()
  WHERE token = p_token;
  
  -- Update password
  UPDATE auth.users
  SET 
    encrypted_password = crypt(p_new_password, gen_salt('bf')),
    raw_app_meta_data = raw_app_meta_data - 'reset_token' - 'reset_sent_at',
    updated_at = now()
  WHERE id = v_user_id;
  
  -- Invalidate all sessions
  DELETE FROM auth.sessions
  WHERE user_id = v_user_id;
  
  RETURN true;
END;
$$;

-- Function to cleanup expired tokens
CREATE OR REPLACE FUNCTION auth.cleanup_expired_tokens()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM auth.password_resets
  WHERE expires_at < now()
    OR used_at IS NOT NULL;
END;
$$;

-- Function to request password reset
CREATE OR REPLACE FUNCTION auth.request_password_reset(p_email text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid;
  v_token text;
BEGIN
  -- Find user
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = p_email;
  
  IF NOT FOUND THEN
    -- Return true even if user not found (security through obscurity)
    RETURN true;
  END IF;
  
  -- Generate reset token
  v_token := auth.generate_reset_token(v_user_id);
  
  -- Update user metadata
  UPDATE auth.users
  SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || 
    jsonb_build_object(
      'reset_token', v_token,
      'reset_sent_at', now()
    )
  WHERE id = v_user_id;
  
  RETURN true;
END;
$$;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION auth.request_password_reset TO anon, authenticated;
GRANT EXECUTE ON FUNCTION auth.complete_password_reset TO anon, authenticated;
GRANT EXECUTE ON FUNCTION auth.check_reset_token TO anon, authenticated;