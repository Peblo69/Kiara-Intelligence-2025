-- Function to get audit logs with pagination and filtering
CREATE OR REPLACE FUNCTION get_audit_logs(
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0,
  p_action text DEFAULT NULL,
  p_target_table text DEFAULT NULL,
  p_start_date timestamptz DEFAULT NULL,
  p_end_date timestamptz DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  admin_id uuid,
  action text,
  target_table text,
  target_id uuid,
  old_data jsonb,
  new_data jsonb,
  metadata jsonb,
  created_at timestamptz,
  admin_info jsonb
) AS $$
BEGIN
  -- Check admin permission
  IF NOT check_admin_permission('view_analytics') THEN
    RAISE EXCEPTION 'Insufficient permissions';
  END IF;

  RETURN QUERY
  SELECT 
    l.id,
    l.admin_id,
    l.action,
    l.target_table,
    l.target_id,
    l.old_data,
    l.new_data,
    l.metadata,
    l.created_at,
    jsonb_build_object(
      'id', a.id,
      'role', a.role,
      'permissions', a.permissions
    ) as admin_info
  FROM admin_audit_logs l
  LEFT JOIN admin_users a ON a.id = l.admin_id
  WHERE 
    (p_action IS NULL OR l.action = p_action)
    AND (p_target_table IS NULL OR l.target_table = p_target_table)
    AND (p_start_date IS NULL OR l.created_at >= p_start_date)
    AND (p_end_date IS NULL OR l.created_at <= p_end_date)
  ORDER BY l.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get audit log summary
CREATE OR REPLACE FUNCTION get_audit_log_summary(
  p_days integer DEFAULT 30
)
RETURNS jsonb AS $$
DECLARE
  v_summary jsonb;
BEGIN
  -- Check admin permission
  IF NOT check_admin_permission('view_analytics') THEN
    RAISE EXCEPTION 'Insufficient permissions';
  END IF;

  SELECT jsonb_build_object(
    'total_actions', COUNT(*),
    'actions_by_type', (
      SELECT jsonb_object_agg(action, count)
      FROM (
        SELECT action, COUNT(*) as count
        FROM admin_audit_logs
        WHERE created_at > now() - (p_days || ' days')::interval
        GROUP BY action
      ) actions
    ),
    'actions_by_table', (
      SELECT jsonb_object_agg(target_table, count)
      FROM (
        SELECT target_table, COUNT(*) as count
        FROM admin_audit_logs
        WHERE created_at > now() - (p_days || ' days')::interval
        GROUP BY target_table
      ) tables
    ),
    'actions_by_admin', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'admin_id', a.id,
          'role', a.role,
          'action_count', COUNT(l.id)
        )
      )
      FROM admin_users a
      LEFT JOIN admin_audit_logs l ON l.admin_id = a.id
      WHERE l.created_at > now() - (p_days || ' days')::interval
      GROUP BY a.id, a.role
    )
  ) INTO v_summary;

  RETURN v_summary;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update audit log policies
DROP POLICY IF EXISTS "Admins can view audit logs" ON admin_audit_logs;
CREATE POLICY "Admins can view audit logs"
  ON admin_audit_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users au
      WHERE au.user_id = auth.uid()
      AND (
        au.role = 'super_admin'
        OR (au.role = 'admin' AND au.permissions->>'view_analytics' = 'true')
      )
    )
  );

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_audit_logs TO authenticated;
GRANT EXECUTE ON FUNCTION get_audit_log_summary TO authenticated;