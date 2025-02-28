/*
  # Payment System Implementation

  1. New Tables
    - `subscription_tiers`
      - Defines available subscription plans
      - Includes features, limits, pricing
    
    - `payment_transactions`
      - Tracks all payment transactions
      - Includes status, amount, type, etc.
    
    - `user_subscriptions`
      - Links users to their subscription
      - Tracks subscription status and period

  2. Functions
    - Process payments
    - Handle subscription changes
    - Manage token allocation
    - Track usage limits

  3. Triggers
    - Auto-update user status
    - Token balance management
    - Subscription period tracking
*/

-- Create subscription tiers table
CREATE TABLE IF NOT EXISTS subscription_tiers (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  price integer NOT NULL,  -- in cents
  token_limit integer NOT NULL,
  features jsonb NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create payment transactions table
CREATE TABLE IF NOT EXISTS payment_transactions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  amount integer NOT NULL,  -- in cents
  currency text DEFAULT 'USD',
  status text NOT NULL CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
  type text NOT NULL CHECK (type IN ('subscription', 'token_purchase')),
  provider text NOT NULL,
  provider_transaction_id text,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create user subscriptions table
CREATE TABLE IF NOT EXISTS user_subscriptions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  tier_id uuid REFERENCES subscription_tiers(id),
  status text NOT NULL CHECK (status IN ('active', 'cancelled', 'expired')),
  current_period_start timestamptz NOT NULL,
  current_period_end timestamptz NOT NULL,
  cancel_at_period_end boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE subscription_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Public can view subscription tiers"
  ON subscription_tiers
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can view own payment transactions"
  ON payment_transactions
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can view own subscription"
  ON user_subscriptions
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Insert default subscription tiers
INSERT INTO subscription_tiers (name, price, token_limit, features) VALUES
  ('Free', 0, 100, '{"chat_history": true, "basic_features": true}'),
  ('Plus', 1999, 7000, '{"chat_history": true, "advanced_features": true, "priority_support": true}'),
  ('Infinity', 4999, -1, '{"chat_history": true, "advanced_features": true, "priority_support": true, "unlimited_tokens": true}');

-- Function to process payment
CREATE OR REPLACE FUNCTION process_payment(
  p_user_id uuid,
  p_amount integer,
  p_type text,
  p_provider text,
  p_provider_transaction_id text,
  p_metadata jsonb DEFAULT '{}'
)
RETURNS payment_transactions AS $$
DECLARE
  v_transaction payment_transactions;
BEGIN
  -- Insert payment transaction
  INSERT INTO payment_transactions (
    user_id,
    amount,
    status,
    type,
    provider,
    provider_transaction_id,
    metadata
  )
  VALUES (
    p_user_id,
    p_amount,
    'completed',
    p_type,
    p_provider,
    p_provider_transaction_id,
    p_metadata
  )
  RETURNING * INTO v_transaction;

  -- Handle subscription payment
  IF p_type = 'subscription' THEN
    -- Get subscription tier based on amount
    WITH tier AS (
      SELECT id, token_limit
      FROM subscription_tiers
      WHERE price = p_amount
      LIMIT 1
    )
    INSERT INTO user_subscriptions (
      user_id,
      tier_id,
      status,
      current_period_start,
      current_period_end
    )
    SELECT
      p_user_id,
      tier.id,
      'active',
      now(),
      now() + interval '1 month'
    FROM tier
    ON CONFLICT (user_id)
    DO UPDATE SET
      tier_id = EXCLUDED.tier_id,
      status = 'active',
      current_period_start = EXCLUDED.current_period_start,
      current_period_end = EXCLUDED.current_period_end,
      updated_at = now();

    -- Update user subscription status
    UPDATE users
    SET
      active_subscription = CASE
        WHEN p_amount >= 4999 THEN 'infinity'
        WHEN p_amount >= 1999 THEN 'plus'
        ELSE 'free'
      END,
      updated_at = now()
    WHERE id = p_user_id;
  
  -- Handle token purchase
  ELSIF p_type = 'token_purchase' THEN
    -- Calculate tokens (1 cent = 0.1 tokens)
    UPDATE users
    SET
      tokens_used = tokens_used + (p_amount / 10),
      updated_at = now()
    WHERE id = p_user_id;
  END IF;

  RETURN v_transaction;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check subscription status
CREATE OR REPLACE FUNCTION check_subscription_status(p_user_id uuid)
RETURNS jsonb AS $$
DECLARE
  v_subscription_data record;
BEGIN
  -- Get user's subscription with tier info
  SELECT 
    s.status,
    s.current_period_end,
    t.name as tier_name,
    t.token_limit,
    t.features
  INTO v_subscription_data
  FROM user_subscriptions s
  JOIN subscription_tiers t ON t.id = s.tier_id
  WHERE s.user_id = p_user_id
    AND s.status = 'active'
    AND s.current_period_end > now();

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'active', false,
      'tier', 'free',
      'token_limit', 100
    );
  END IF;

  RETURN jsonb_build_object(
    'active', true,
    'tier', v_subscription_data.tier_name,
    'token_limit', v_subscription_data.token_limit,
    'period_end', v_subscription_data.current_period_end,
    'features', v_subscription_data.features
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user's token balance
CREATE OR REPLACE FUNCTION get_token_balance(p_user_id uuid)
RETURNS integer AS $$
DECLARE
  v_subscription jsonb;
  v_tokens_used integer;
BEGIN
  -- Get subscription status
  v_subscription := check_subscription_status(p_user_id);
  
  -- Get tokens used
  SELECT tokens_used INTO v_tokens_used
  FROM users
  WHERE id = p_user_id;

  -- If unlimited tokens
  IF (v_subscription->>'token_limit')::integer = -1 THEN
    RETURN -1;
  END IF;

  -- Return remaining tokens
  RETURN (v_subscription->>'token_limit')::integer - COALESCE(v_tokens_used, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user can use tokens
CREATE OR REPLACE FUNCTION can_use_tokens(p_user_id uuid, p_tokens_needed integer)
RETURNS boolean AS $$
DECLARE
  v_balance integer;
BEGIN
  v_balance := get_token_balance(p_user_id);
  
  -- If unlimited tokens
  IF v_balance = -1 THEN
    RETURN true;
  END IF;

  RETURN v_balance >= p_tokens_needed;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create triggers for updated_at
CREATE TRIGGER update_subscription_tiers_updated_at
  BEFORE UPDATE ON subscription_tiers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_payment_transactions_updated_at
  BEFORE UPDATE ON payment_transactions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_user_subscriptions_updated_at
  BEFORE UPDATE ON user_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION process_payment TO authenticated;
GRANT EXECUTE ON FUNCTION check_subscription_status TO authenticated;
GRANT EXECUTE ON FUNCTION get_token_balance TO authenticated;
GRANT EXECUTE ON FUNCTION can_use_tokens TO authenticated;