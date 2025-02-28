/*
  # Fix Admin Get User Details Function

  1. Changes
    - Rewrites admin_get_user_details function to use CTEs for better organization
    - Fixes GROUP BY issues with chat aggregation
    - Adds proper ordering for payments and chats
    - Improves NULL handling with COALESCE
    - Optimizes query performance

  2. Security
    - Maintains existing permission checks
    - Preserves SECURITY DEFINER setting
*/

-- Drop existing function if it exists
DROP FUNCTION IF EXISTS admin_get_user_details(uuid);

-- Create improved function
CREATE OR REPLACE FUNCTION admin_get_user_details(p_user_id uuid)
RETURNS jsonb AS $$
BEGIN
  -- Check admin permission
  IF NOT check_admin_permission('view_users') THEN
    RAISE EXCEPTION 'Insufficient permissions';
  END IF;

  RETURN (
    WITH user_data AS (
      SELECT 
        u.id,
        u.email,
        u.display_name,
        u.tokens_used,
        u.active_subscription,
        u.created_at
      FROM users u
      WHERE u.id = p_user_id
    ),
    subscription_data AS (
      SELECT 
        s.tier_id,
        s.status,
        s.current_period_end
      FROM user_subscriptions s
      WHERE s.user_id = p_user_id
      AND s.status = 'active'
      LIMIT 1
    ),
    payment_data AS (
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', p.id,
          'amount', p.amount,
          'status', p.status,
          'created_at', p.created_at
        ) ORDER BY p.created_at DESC
      ) as payments
      FROM payment_transactions p
      WHERE p.user_id = p_user_id
      LIMIT 10
    ),
    chat_data AS (
      SELECT 
        COUNT(*) as total_count,
        jsonb_agg(
          jsonb_build_object(
            'id', c.id,
            'title', c.title,
            'model', c.model,
            'message_count', c.message_count,
            'created_at', c.created_at
          ) ORDER BY c.created_at DESC
        ) as recent
      FROM (
        SELECT * FROM chats 
        WHERE user_id = p_user_id
        ORDER BY created_at DESC 
        LIMIT 5
      ) c
    )
    SELECT jsonb_build_object(
      'user', jsonb_build_object(
        'id', u.id,
        'email', u.email,
        'display_name', u.display_name,
        'tokens_used', u.tokens_used,
        'active_subscription', u.active_subscription,
        'created_at', u.created_at
      ),
      'subscription', COALESCE(
        jsonb_build_object(
          'tier', s.tier_id,
          'status', s.status,
          'period_end', s.current_period_end
        ),
        null
      ),
      'payments', COALESCE(p.payments, '[]'::jsonb),
      'chats', jsonb_build_object(
        'total_count', COALESCE(c.total_count, 0),
        'recent', COALESCE(c.recent, '[]'::jsonb)
      )
    )
    FROM user_data u
    LEFT JOIN subscription_data s ON true
    LEFT JOIN payment_data p ON true
    LEFT JOIN chat_data c ON true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION admin_get_user_details TO authenticated;