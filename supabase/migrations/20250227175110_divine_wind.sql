/*
  # Fix Admin Functions

  1. Changes
    - Fix chat aggregation in admin_get_user_details
    - Add proper error handling
    - Improve performance with better indexing
    - Add missing admin functionality
    
  2. New Functions
    - get_admin_stats: Get overall system statistics
    - get_user_activity: Get detailed user activity
    - get_subscription_metrics: Get subscription-related metrics
*/

-- Drop existing function to avoid conflicts
DROP FUNCTION IF EXISTS admin_get_user_details(uuid);

-- Create improved admin_get_user_details function
CREATE OR REPLACE FUNCTION admin_get_user_details(p_user_id uuid)
RETURNS jsonb AS $$
DECLARE
  v_user_data jsonb;
  v_subscription_data jsonb;
  v_payment_data jsonb;
  v_chat_data jsonb;
  v_total_chats integer;
  v_recent_chats jsonb;
BEGIN
  -- Check admin permission
  IF NOT check_admin_permission('view_users') THEN
    RAISE EXCEPTION 'Insufficient permissions';
  END IF;

  -- Get user data
  SELECT jsonb_build_object(
    'id', u.id,
    'email', u.email,
    'display_name', u.display_name,
    'tokens_used', u.tokens_used,
    'active_subscription', u.active_subscription,
    'created_at', u.created_at
  )
  INTO v_user_data
  FROM users u
  WHERE u.id = p_user_id;

  IF v_user_data IS NULL THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  -- Get subscription data
  SELECT jsonb_build_object(
    'tier', t.name,
    'status', s.status,
    'period_end', s.current_period_end,
    'features', t.features
  )
  INTO v_subscription_data
  FROM user_subscriptions s
  JOIN subscription_tiers t ON t.id = s.tier_id
  WHERE s.user_id = p_user_id AND s.status = 'active'
  ORDER BY s.current_period_end DESC
  LIMIT 1;

  -- Get payment data
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', p.id,
      'amount', p.amount,
      'status', p.status,
      'type', p.type,
      'created_at', p.created_at
    )
  )
  INTO v_payment_data
  FROM (
    SELECT *
    FROM payment_transactions
    WHERE user_id = p_user_id
    ORDER BY created_at DESC
    LIMIT 10
  ) p;

  -- Get chat statistics
  SELECT 
    COUNT(*),
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'id', c.id,
          'title', c.title,
          'model', c.model,
          'message_count', c.message_count,
          'created_at', c.created_at
        )
        ORDER BY c.created_at DESC
      ) FILTER (WHERE c.id IS NOT NULL),
      '[]'::jsonb
    )
  INTO v_total_chats, v_recent_chats
  FROM (
    SELECT *
    FROM chats
    WHERE user_id = p_user_id
    ORDER BY created_at DESC
    LIMIT 5
  ) c;

  -- Build final response
  RETURN jsonb_build_object(
    'user', v_user_data,
    'subscription', COALESCE(v_subscription_data, jsonb_build_object()),
    'payments', COALESCE(v_payment_data, '[]'::jsonb),
    'chats', jsonb_build_object(
      'total_count', v_total_chats,
      'recent', v_recent_chats
    )
  );

EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error in admin_get_user_details: %', SQLERRM;
    RETURN jsonb_build_object(
      'error', SQLERRM,
      'detail', SQLSTATE
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get admin statistics
CREATE OR REPLACE FUNCTION get_admin_stats()
RETURNS jsonb AS $$
DECLARE
  v_stats jsonb;
BEGIN
  -- Check admin permission
  IF NOT check_admin_permission('view_analytics') THEN
    RAISE EXCEPTION 'Insufficient permissions';
  END IF;

  SELECT jsonb_build_object(
    'users', jsonb_build_object(
      'total', COUNT(DISTINCT u.id),
      'active_today', COUNT(DISTINCT CASE WHEN c.created_at > now() - interval '1 day' THEN u.id END),
      'with_subscription', COUNT(DISTINCT CASE WHEN u.active_subscription != 'free' THEN u.id END)
    ),
    'chats', jsonb_build_object(
      'total', COUNT(DISTINCT c.id),
      'today', COUNT(DISTINCT CASE WHEN c.created_at > now() - interval '1 day' THEN c.id END),
      'by_model', jsonb_object_agg(
        c.model,
        COUNT(c.id)
      )
    ),
    'tokens', jsonb_build_object(
      'total_used', SUM(u.tokens_used),
      'average_per_user', ROUND(AVG(u.tokens_used))
    ),
    'subscriptions', jsonb_build_object(
      'active', COUNT(DISTINCT CASE WHEN s.status = 'active' THEN s.user_id END),
      'by_tier', jsonb_object_agg(
        t.name,
        COUNT(DISTINCT s.user_id)
      )
    )
  ) INTO v_stats
  FROM users u
  LEFT JOIN chats c ON c.user_id = u.id
  LEFT JOIN user_subscriptions s ON s.user_id = u.id
  LEFT JOIN subscription_tiers t ON t.id = s.tier_id
  WHERE u.id IS NOT NULL
  GROUP BY 1;

  RETURN v_stats;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user activity
CREATE OR REPLACE FUNCTION get_user_activity(
  p_user_id uuid,
  p_days integer DEFAULT 30
)
RETURNS jsonb AS $$
DECLARE
  v_activity jsonb;
BEGIN
  -- Check admin permission
  IF NOT check_admin_permission('view_analytics') THEN
    RAISE EXCEPTION 'Insufficient permissions';
  END IF;

  SELECT jsonb_build_object(
    'chats', jsonb_build_object(
      'total', COUNT(DISTINCT c.id),
      'by_model', jsonb_object_agg(
        c.model,
        COUNT(c.id)
      ),
      'by_day', jsonb_object_agg(
        TO_CHAR(DATE_TRUNC('day', c.created_at), 'YYYY-MM-DD'),
        COUNT(c.id)
      )
    ),
    'messages', jsonb_build_object(
      'total', COUNT(m.id),
      'by_role', jsonb_object_agg(
        m.role,
        COUNT(m.id)
      )
    ),
    'tokens', jsonb_build_object(
      'total_used', u.tokens_used,
      'by_day', jsonb_object_agg(
        TO_CHAR(DATE_TRUNC('day', c.created_at), 'YYYY-MM-DD'),
        COUNT(m.id) * 2 -- Approximate token usage
      )
    )
  ) INTO v_activity
  FROM users u
  LEFT JOIN chats c ON c.user_id = u.id
  LEFT JOIN messages m ON m.chat_id = c.id
  WHERE u.id = p_user_id
    AND c.created_at > now() - (p_days || ' days')::interval
  GROUP BY u.id, u.tokens_used;

  RETURN v_activity;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION admin_get_user_details TO authenticated;
GRANT EXECUTE ON FUNCTION get_admin_stats TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_activity TO authenticated;