/*
  # Token Management System

  1. New Tables
    - `token_transactions`
      - Records all token changes (additions, deductions)
      - Tracks reason for change (purchase, admin, usage, etc.)
      - Links to payments and subscriptions
    
  2. Functions
    - Token management functions
    - Real-time token updates
    - Subscription-based token allocation
    
  3. Security
    - RLS policies for token transactions
    - Admin-only token management
    - Audit logging for all token changes
*/

-- Drop existing functions first to avoid conflicts
DROP FUNCTION IF EXISTS get_user_token_history(uuid, integer);
DROP FUNCTION IF EXISTS admin_update_user_tokens(uuid, integer);
DROP FUNCTION IF EXISTS update_user_tokens(uuid, integer, text, uuid, uuid, jsonb);

-- Token transactions table
CREATE TABLE IF NOT EXISTS token_transactions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  amount integer NOT NULL, -- Positive for additions, negative for deductions
  reason text NOT NULL CHECK (reason IN ('purchase', 'admin', 'usage', 'subscription', 'bonus')),
  payment_id uuid REFERENCES payment_transactions(id) ON DELETE SET NULL,
  subscription_id uuid REFERENCES user_subscriptions(id) ON DELETE SET NULL,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE token_transactions ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view own token transactions"
  ON token_transactions
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins can manage token transactions"
  ON token_transactions
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users au
      WHERE au.user_id = auth.uid()
      AND (au.role = 'super_admin' OR au.permissions->>'manage_tokens' = 'true')
    )
  );

-- Function to safely update user tokens
CREATE OR REPLACE FUNCTION update_user_tokens(
  p_user_id uuid,
  p_amount integer,
  p_reason text,
  p_payment_id uuid DEFAULT NULL,
  p_subscription_id uuid DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'
)
RETURNS jsonb AS $$
DECLARE
  v_old_tokens integer;
  v_new_tokens integer;
  v_transaction_id uuid;
BEGIN
  -- Get current tokens with lock
  SELECT tokens_used INTO v_old_tokens
  FROM users
  WHERE id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  -- Calculate new token amount
  v_new_tokens := v_old_tokens + p_amount;

  -- Prevent negative tokens
  IF v_new_tokens < 0 THEN
    RAISE EXCEPTION 'Insufficient tokens';
  END IF;

  -- Update user tokens
  UPDATE users
  SET 
    tokens_used = v_new_tokens,
    updated_at = now()
  WHERE id = p_user_id;

  -- Record transaction
  INSERT INTO token_transactions (
    user_id,
    amount,
    reason,
    payment_id,
    subscription_id,
    metadata
  )
  VALUES (
    p_user_id,
    p_amount,
    p_reason,
    p_payment_id,
    p_subscription_id,
    p_metadata
  )
  RETURNING id INTO v_transaction_id;

  -- Return updated info
  RETURN jsonb_build_object(
    'success', true,
    'old_tokens', v_old_tokens,
    'new_tokens', v_new_tokens,
    'transaction_id', v_transaction_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function for admins to update user tokens
CREATE OR REPLACE FUNCTION admin_update_user_tokens(
  p_user_id uuid,
  p_tokens integer
)
RETURNS jsonb AS $$
DECLARE
  v_old_tokens integer;
  v_token_change integer;
  v_result jsonb;
BEGIN
  -- Check admin permission
  IF NOT check_admin_permission('manage_tokens') THEN
    RAISE EXCEPTION 'Insufficient permissions';
  END IF;

  -- Get current tokens
  SELECT tokens_used INTO v_old_tokens
  FROM users
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  -- Calculate token change
  v_token_change := p_tokens - v_old_tokens;

  -- Update tokens
  v_result := update_user_tokens(
    p_user_id := p_user_id,
    p_amount := v_token_change,
    p_reason := 'admin',
    p_metadata := jsonb_build_object(
      'admin_id', (SELECT id FROM admin_users WHERE user_id = auth.uid()),
      'old_tokens', v_old_tokens,
      'new_tokens', p_tokens
    )
  );

  -- Log admin action
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
      'change_amount', v_token_change,
      'transaction_id', v_result->>'transaction_id'
    )
  FROM admin_users au
  WHERE au.user_id = auth.uid();

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user token history
CREATE OR REPLACE FUNCTION get_user_token_history(
  p_user_id uuid,
  p_days integer DEFAULT 30
)
RETURNS TABLE (
  date timestamptz,
  amount integer,
  reason text,
  metadata jsonb,
  running_balance bigint
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    t.created_at as date,
    t.amount,
    t.reason,
    t.metadata,
    SUM(t.amount) OVER (
      ORDER BY t.created_at
      ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
    )::bigint as running_balance
  FROM token_transactions t
  WHERE t.user_id = p_user_id
    AND t.created_at > now() - (p_days || ' days')::interval
  ORDER BY t.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enable real-time subscriptions for token changes
ALTER PUBLICATION supabase_realtime ADD TABLE token_transactions;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION update_user_tokens TO authenticated;
GRANT EXECUTE ON FUNCTION admin_update_user_tokens TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_token_history TO authenticated;