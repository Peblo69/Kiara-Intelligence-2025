-- Create admin users table
CREATE TABLE admin_users (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  role text NOT NULL CHECK (role IN ('super_admin', 'admin', 'support')),
  permissions jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create admin audit logs
CREATE TABLE admin_audit_logs (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_id uuid REFERENCES admin_users(id) ON DELETE SET NULL,
  action text NOT NULL,
  target_table text NOT NULL,
  target_id uuid,
  old_data jsonb,
  new_data jsonb,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- Create admin settings
CREATE TABLE admin_settings (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  key text UNIQUE NOT NULL,
  value jsonb NOT NULL,
  description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_settings ENABLE ROW LEVEL SECURITY;

-- Admin user policies
CREATE POLICY "Super admins can do everything"
  ON admin_users
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users au
      WHERE au.user_id = auth.uid()
      AND au.role = 'super_admin'
    )
  );

CREATE POLICY "Admins can view other admins"
  ON admin_users
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users au
      WHERE au.user_id = auth.uid()
      AND au.role IN ('super_admin', 'admin')
    )
  );

-- Audit log policies
CREATE POLICY "Admins can view audit logs"
  ON admin_audit_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users au
      WHERE au.user_id = auth.uid()
      AND au.role IN ('super_admin', 'admin')
    )
  );

CREATE POLICY "System can insert audit logs"
  ON admin_audit_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Settings policies
CREATE POLICY "Admins can manage settings"
  ON admin_settings
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users au
      WHERE au.user_id = auth.uid()
      AND au.role IN ('super_admin', 'admin')
    )
  );

-- Function to check if user is admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM admin_users
    WHERE user_id = auth.uid()
    AND role IN ('super_admin', 'admin')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check admin permissions
CREATE OR REPLACE FUNCTION check_admin_permission(permission text)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM admin_users
    WHERE user_id = auth.uid()
    AND (
      role = 'super_admin'
      OR (role IN ('admin', 'support') AND permissions->permission = 'true')
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to log admin action
CREATE OR REPLACE FUNCTION log_admin_action(
  p_action text,
  p_target_table text,
  p_target_id uuid,
  p_old_data jsonb DEFAULT NULL,
  p_new_data jsonb DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'
)
RETURNS void AS $$
DECLARE
  v_admin_id uuid;
BEGIN
  -- Get admin ID
  SELECT id INTO v_admin_id
  FROM admin_users
  WHERE user_id = auth.uid();

  -- Insert audit log
  INSERT INTO admin_audit_logs (
    admin_id,
    action,
    target_table,
    target_id,
    old_data,
    new_data,
    metadata
  ) VALUES (
    v_admin_id,
    p_action,
    p_target_table,
    p_target_id,
    p_old_data,
    p_new_data,
    p_metadata
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update user tokens
CREATE OR REPLACE FUNCTION admin_update_user_tokens(
  p_user_id uuid,
  p_tokens integer
)
RETURNS void AS $$
BEGIN
  -- Check admin permission
  IF NOT check_admin_permission('manage_tokens') THEN
    RAISE EXCEPTION 'Insufficient permissions';
  END IF;

  -- Get current tokens
  WITH old_data AS (
    SELECT tokens_used FROM users WHERE id = p_user_id
  )
  UPDATE users
  SET tokens_used = p_tokens
  WHERE id = p_user_id;

  -- Log action
  PERFORM log_admin_action(
    'update_tokens',
    'users',
    p_user_id,
    jsonb_build_object('tokens_used', (SELECT tokens_used FROM old_data)),
    jsonb_build_object('tokens_used', p_tokens)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user details for admin
CREATE OR REPLACE FUNCTION admin_get_user_details(p_user_id uuid)
RETURNS jsonb AS $$
DECLARE
  v_result jsonb;
BEGIN
  -- Check admin permission
  IF NOT check_admin_permission('view_users') THEN
    RAISE EXCEPTION 'Insufficient permissions';
  END IF;

  -- Get user details
  SELECT jsonb_build_object(
    'user', jsonb_build_object(
      'id', u.id,
      'email', u.email,
      'display_name', u.display_name,
      'tokens_used', u.tokens_used,
      'active_subscription', u.active_subscription,
      'created_at', u.created_at
    ),
    'subscription', (
      SELECT jsonb_build_object(
        'tier', s.tier_id,
        'status', s.status,
        'period_end', s.current_period_end
      )
      FROM user_subscriptions s
      WHERE s.user_id = u.id
      AND s.status = 'active'
      LIMIT 1
    ),
    'payments', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', p.id,
          'amount', p.amount,
          'status', p.status,
          'created_at', p.created_at
        )
      )
      FROM payment_transactions p
      WHERE p.user_id = u.id
      ORDER BY p.created_at DESC
      LIMIT 10
    ),
    'chats', (
      SELECT jsonb_build_object(
        'total_count', COUNT(*),
        'recent', jsonb_agg(
          jsonb_build_object(
            'id', c.id,
            'title', c.title,
            'model', c.model,
            'message_count', c.message_count,
            'created_at', c.created_at
          )
        )
      )
      FROM chats c
      WHERE c.user_id = u.id
      GROUP BY c.user_id
    )
  ) INTO v_result
  FROM users u
  WHERE u.id = p_user_id;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to search users
CREATE OR REPLACE FUNCTION admin_search_users(
  p_query text,
  p_limit integer DEFAULT 20,
  p_offset integer DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  email text,
  display_name text,
  tokens_used integer,
  active_subscription text,
  created_at timestamptz
) AS $$
BEGIN
  -- Check admin permission
  IF NOT check_admin_permission('view_users') THEN
    RAISE EXCEPTION 'Insufficient permissions';
  END IF;

  RETURN QUERY
  SELECT 
    u.id,
    u.email,
    u.display_name,
    u.tokens_used,
    u.active_subscription,
    u.created_at
  FROM users u
  WHERE 
    u.email ILIKE '%' || p_query || '%'
    OR u.display_name ILIKE '%' || p_query || '%'
  ORDER BY u.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION is_admin TO authenticated;
GRANT EXECUTE ON FUNCTION check_admin_permission TO authenticated;
GRANT EXECUTE ON FUNCTION admin_update_user_tokens TO authenticated;
GRANT EXECUTE ON FUNCTION admin_get_user_details TO authenticated;
GRANT EXECUTE ON FUNCTION admin_search_users TO authenticated;