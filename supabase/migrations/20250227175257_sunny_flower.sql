/*
  # Fix Admin Token Management

  1. Changes
    - Fix token update function
    - Add proper error handling
    - Add audit logging
    - Fix user details retrieval
    
  2. New Functions
    - update_user_tokens: Safely update user tokens
    - get_user_token_history: Get token usage history
*/

-- Drop existing function if it exists
DROP FUNCTION IF EXISTS admin_update_user_tokens(uuid, integer);

-- Create improved token update function
CREATE OR REPLACE FUNCTION admin_update_user_tokens(
  p_user_id uuid,
  p_tokens integer
)
RETURNS jsonb AS $$
DECLARE
  v_old_tokens integer;
  v_user_data jsonb;
BEGIN
  -- Check admin permission
  IF NOT check_admin_permission('manage_tokens') THEN
    RAISE EXCEPTION 'Insufficient permissions';
  END IF;

  -- Get current token count
  SELECT tokens_used, jsonb_build_object(
    'id', id,
    'email', email,
    'display_name', display_name,
    'tokens_used', tokens_used,
    'active_subscription', active_subscription
  )
  INTO v_old_tokens, v_user_data
  FROM users
  WHERE id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  -- Update tokens
  UPDATE users
  SET 
    tokens_used = p_tokens,
    updated_at = now()
  WHERE id = p_user_id;

  -- Log the action
  INSERT INTO admin_audit_logs (
    admin_id,
    action,
    target_table,
    target_id,
    old_data,
    new_data,
    metadata
  )
  SELECT
    au.id,
    'update_tokens',
    'users',
    p_user_id,
    jsonb_build_object('tokens_used', v_old_tokens),
    jsonb_build_object('tokens_used', p_tokens),
    jsonb_build_object(
      'change_amount', p_tokens - v_old_tokens,
      'timestamp', now()
    )
  FROM admin_users au
  WHERE au.user_id = auth.uid();

  -- Return updated user data
  RETURN jsonb_build_object(
    'success', true,
    'old_tokens', v_old_tokens,
    'new_tokens', p_tokens,
    'user', v_user_data
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'detail', SQLSTATE
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get token history
CREATE OR REPLACE FUNCTION get_user_token_history(
  p_user_id uuid,
  p_days integer DEFAULT 30
)
RETURNS TABLE (
  date date,
  tokens_used integer,
  tokens_added integer,
  balance integer
) AS $$
BEGIN
  -- Check admin permission
  IF NOT check_admin_permission('view_analytics') THEN
    RAISE EXCEPTION 'Insufficient permissions';
  END IF;

  RETURN QUERY
  WITH token_changes AS (
    -- Get token updates from audit logs
    SELECT 
      DATE_TRUNC('day', created_at)::date as change_date,
      COALESCE((new_data->>'tokens_used')::integer, 0) - 
      COALESCE((old_data->>'tokens_used')::integer, 0) as token_change
    FROM admin_audit_logs
    WHERE target_table = 'users'
      AND target_id = p_user_id
      AND action = 'update_tokens'
      AND created_at > now() - (p_days || ' days')::interval
  ),
  daily_usage AS (
    -- Calculate daily token usage from messages
    SELECT 
      DATE_TRUNC('day', m.created_at)::date as usage_date,
      COUNT(*) * 2 as tokens_used -- Approximate token usage
    FROM messages m
    JOIN chats c ON c.id = m.chat_id
    WHERE c.user_id = p_user_id
      AND m.created_at > now() - (p_days || ' days')::interval
    GROUP BY DATE_TRUNC('day', m.created_at)::date
  )
  SELECT 
    d::date as date,
    COALESCE(du.tokens_used, 0) as tokens_used,
    COALESCE(tc.token_change, 0) as tokens_added,
    SUM(COALESCE(tc.token_change, 0) - COALESCE(du.tokens_used, 0)) 
      OVER (ORDER BY d::date) as balance
  FROM generate_series(
    now()::date - (p_days || ' days')::interval,
    now()::date,
    '1 day'::interval
  ) d
  LEFT JOIN token_changes tc ON tc.change_date = d::date
  LEFT JOIN daily_usage du ON du.usage_date = d::date
  ORDER BY d::date DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION admin_update_user_tokens TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_token_history TO authenticated;