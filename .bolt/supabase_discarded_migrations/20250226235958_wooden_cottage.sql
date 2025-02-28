-- Function to get admin stats
CREATE OR REPLACE FUNCTION get_admin_stats()
RETURNS jsonb AS $$
DECLARE
  v_total_users integer;
  v_active_users integer;
  v_total_chats integer;
  v_total_tokens integer;
BEGIN
  -- Ensure admin permission
  IF NOT check_admin_permission('view_analytics') THEN
    RAISE EXCEPTION 'Insufficient permissions';
  END IF;

  -- Get stats
  SELECT 
    COUNT(*),
    COUNT(*) FILTER (WHERE last_sign_in_at > now() - interval '30 days')
  INTO v_total_users, v_active_users
  FROM auth.users;

  SELECT COUNT(*) INTO v_total_chats
  FROM chats;

  SELECT COALESCE(SUM(tokens_used), 0) INTO v_total_tokens
  FROM users;

  RETURN jsonb_build_object(
    'totalUsers', v_total_users,
    'activeUsers', v_active_users,
    'totalChats', v_total_chats,
    'totalTokensUsed', v_total_tokens
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update user subscription
CREATE OR REPLACE FUNCTION admin_update_subscription(
  p_user_id uuid,
  p_tier text
)
RETURNS void AS $$
BEGIN
  -- Ensure admin permission
  IF NOT check_admin_permission('manage_subscriptions') THEN
    RAISE EXCEPTION 'Insufficient permissions';
  END IF;

  -- Update subscription
  UPDATE users
  SET active_subscription = p_tier
  WHERE id = p_user_id;

  -- Log action
  PERFORM log_admin_action(
    'update_subscription',
    'users',
    p_user_id,
    jsonb_build_object('tier', p_tier)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to ban user
CREATE OR REPLACE FUNCTION admin_ban_user(p_user_id uuid)
RETURNS void AS $$
BEGIN
  -- Ensure admin permission
  IF NOT check_admin_permission('manage_users') THEN
    RAISE EXCEPTION 'Insufficient permissions';
  END IF;

  -- Ban user
  UPDATE auth.users
  SET banned_until = 'infinity'
  WHERE id = p_user_id;

  -- Log action
  PERFORM log_admin_action(
    'ban_user',
    'users',
    p_user_id,
    jsonb_build_object('banned', true)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to unban user
CREATE OR REPLACE FUNCTION admin_unban_user(p_user_id uuid)
RETURNS void AS $$
BEGIN
  -- Ensure admin permission
  IF NOT check_admin_permission('manage_users') THEN
    RAISE EXCEPTION 'Insufficient permissions';
  END IF;

  -- Unban user
  UPDATE auth.users
  SET banned_until = NULL
  WHERE id = p_user_id;

  -- Log action
  PERFORM log_admin_action(
    'unban_user',
    'users',
    p_user_id,
    jsonb_build_object('banned', false)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_admin_stats TO authenticated;
GRANT EXECUTE ON FUNCTION admin_update_subscription TO authenticated;
GRANT EXECUTE ON FUNCTION admin_ban_user TO authenticated;
GRANT EXECUTE ON FUNCTION admin_unban_user TO authenticated;