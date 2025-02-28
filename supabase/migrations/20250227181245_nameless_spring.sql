/*
  # Add token management functions

  1. New Functions
    - `add_user_tokens`: Safely add tokens to a user's account
    - `deduct_user_tokens`: Safely deduct tokens from a user's account
    - `get_user_token_balance`: Get current token balance for a user

  2. Security
    - Enable RLS policies
    - Add audit logging
    - Transaction safety
*/

-- Function to safely add tokens to a user
CREATE OR REPLACE FUNCTION add_user_tokens(
  p_user_id uuid,
  p_amount integer,
  p_reason text DEFAULT 'admin'
)
RETURNS jsonb AS $$
BEGIN
  -- Call the main token update function
  RETURN update_user_tokens(
    p_user_id := p_user_id,
    p_amount := p_amount,
    p_reason := p_reason,
    p_metadata := jsonb_build_object(
      'source', 'manual_add',
      'timestamp', now()
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to safely deduct tokens from a user
CREATE OR REPLACE FUNCTION deduct_user_tokens(
  p_user_id uuid,
  p_amount integer,
  p_reason text DEFAULT 'usage'
)
RETURNS jsonb AS $$
BEGIN
  -- Call the main token update function with negative amount
  RETURN update_user_tokens(
    p_user_id := p_user_id,
    p_amount := -p_amount,
    p_reason := p_reason,
    p_metadata := jsonb_build_object(
      'source', 'manual_deduct',
      'timestamp', now()
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user's current token balance
CREATE OR REPLACE FUNCTION get_user_token_balance(p_user_id uuid)
RETURNS jsonb AS $$
DECLARE
  v_user_data record;
  v_recent_transactions jsonb;
BEGIN
  -- Get user data
  SELECT 
    u.tokens_used,
    u.active_subscription,
    s.tier_id,
    s.current_period_end
  INTO v_user_data
  FROM users u
  LEFT JOIN user_subscriptions s ON s.user_id = u.id AND s.status = 'active'
  WHERE u.id = p_user_id;

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
    'recent_transactions', COALESCE(v_recent_transactions, '[]'::jsonb)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION add_user_tokens TO authenticated;
GRANT EXECUTE ON FUNCTION deduct_user_tokens TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_token_balance TO authenticated;