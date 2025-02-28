-- Drop existing functions first
DROP FUNCTION IF EXISTS auth.validate_reset_token(text);
DROP FUNCTION IF EXISTS auth.complete_password_reset(text, text);

-- Create password reset table if not exists
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

-- Function to handle password reset request
CREATE OR REPLACE FUNCTION auth.handle_password_reset_request(p_email text)
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
  v_token := encode(gen_random_bytes(32), 'hex');
  
  -- Store token with expiry
  INSERT INTO auth.password_resets (
    user_id,
    token,
    expires_at
  )
  VALUES (
    v_user_id,
    v_token,
    now() + interval '24 hours'
  );
  
  -- Update user metadata
  UPDATE auth.users
  SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || 
    jsonb_build_object(
      'reset_token', v_token,
      'reset_sent_at', now(),
      'reset_redirect_to', 'https://scintillating-arithmetic-d0bbfb.netlify.app/auth/reset-password'
    )
  WHERE id = v_user_id;
  
  RETURN true;
END;
$$;

-- Function to check reset token validity
CREATE OR REPLACE FUNCTION auth.check_reset_token(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid;
  v_email text;
  v_redirect_url text;
BEGIN
  -- Get user info from valid token
  SELECT 
    u.id,
    u.email,
    u.raw_app_meta_data->>'reset_redirect_to'
  INTO v_user_id, v_email, v_redirect_url
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
    'email', v_email,
    'redirect_url', v_redirect_url
  );
END;
$$;

-- Function to complete password reset
CREATE OR REPLACE FUNCTION auth.finish_password_reset(
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
  
  -- Update password and clear reset metadata
  UPDATE auth.users
  SET 
    encrypted_password = crypt(p_new_password, gen_salt('bf')),
    raw_app_meta_data = raw_app_meta_data - 'reset_token' - 'reset_sent_at' - 'reset_redirect_to',
    updated_at = now()
  WHERE id = v_user_id;
  
  -- Invalidate all sessions
  DELETE FROM auth.sessions
  WHERE user_id = v_user_id;
  
  RETURN true;
END;
$$;

-- Function to get user's current token balance
CREATE OR REPLACE FUNCTION get_user_token_balance(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_data record;
  v_recent_transactions jsonb;
  v_time_until_reset interval;
  v_can_reset boolean;
BEGIN
  -- Get user data
  SELECT 
    u.tokens_used,
    u.active_subscription,
    u.last_token_reset,
    s.tier_id,
    s.current_period_end
  INTO v_user_data
  FROM users u
  LEFT JOIN user_subscriptions s ON s.user_id = u.id AND s.status = 'active'
  WHERE u.id = p_user_id;

  -- Check if user can get a token reset
  SELECT 
    CASE 
      WHEN v_user_data.tokens_used < 80 AND 
           (v_user_data.last_token_reset IS NULL OR 
            v_user_data.last_token_reset < now() - interval '24 hours')
      THEN true
      ELSE false
    END INTO v_can_reset;

  -- Calculate time until next reset
  IF v_user_data.last_token_reset IS NOT NULL THEN
    v_time_until_reset := greatest(
      (v_user_data.last_token_reset + interval '24 hours') - now(),
      interval '0'
    );
  ELSE
    v_time_until_reset := interval '0';
  END IF;

  -- Get recent transactions
  SELECT jsonb_agg(
    jsonb_build_object(
      'amount', t.amount,
      'reason', t.reason,
      'created_at', t.created_at
    )
    ORDER BY t.created_at DESC
  )
  INTO v_recent_transactions
  FROM (
    SELECT *
    FROM token_transactions
    WHERE user_id = p_user_id
    ORDER BY created_at DESC
    LIMIT 5
  ) t;

  RETURN jsonb_build_object(
    'current_balance', COALESCE(v_user_data.tokens_used, 0),
    'subscription_tier', v_user_data.active_subscription,
    'subscription_expires', v_user_data.current_period_end,
    'can_reset', v_can_reset,
    'time_until_reset', v_time_until_reset,
    'recent_transactions', COALESCE(v_recent_transactions, '[]'::jsonb)
  );
END;
$$;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION auth.handle_password_reset_request TO anon, authenticated;
GRANT EXECUTE ON FUNCTION auth.check_reset_token TO anon, authenticated;
GRANT EXECUTE ON FUNCTION auth.finish_password_reset TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_user_token_balance TO authenticated;