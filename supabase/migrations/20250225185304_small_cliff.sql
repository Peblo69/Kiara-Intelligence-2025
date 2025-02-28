/*
  # Add stored procedures for chat operations

  1. Functions
    - check_and_update_quota: Checks and updates user quota
    - record_payment: Records a payment and updates user subscription/tokens
    - increment_tokens_used: Increments a user's token usage
    - deduct_tokens: Deducts tokens from a user's balance

  2. Security
    - All functions are SECURITY DEFINER to run with elevated privileges
    - Input validation and error handling included
*/

-- Function to check and update quota
CREATE OR REPLACE FUNCTION check_and_update_quota(
  p_user_id uuid,
  p_tokens_to_use integer
)
RETURNS boolean AS $$
DECLARE
  v_quota quotas%ROWTYPE;
  v_now timestamptz := now();
BEGIN
  -- Get user's quota
  SELECT * INTO v_quota
  FROM quotas
  WHERE user_id = p_user_id
  FOR UPDATE;

  -- If no quota exists, create one
  IF NOT FOUND THEN
    INSERT INTO quotas (
      user_id,
      plan,
      limits,
      usage,
      period_start,
      period_end
    ) VALUES (
      p_user_id,
      'free',
      jsonb_build_object(
        'maxChats', 10,
        'maxTokensPerDay', 1000,
        'maxMemories', 50,
        'maxFileSize', 5242880
      ),
      jsonb_build_object(
        'currentTokens', 0
      ),
      v_now,
      v_now + interval '1 day'
    )
    RETURNING * INTO v_quota;
  END IF;

  -- Check if period has expired
  IF v_now > v_quota.period_end THEN
    -- Reset period
    UPDATE quotas
    SET
      usage = jsonb_build_object('currentTokens', 0),
      period_start = v_now,
      period_end = v_now + interval '1 day',
      reset_at = v_now
    WHERE user_id = p_user_id;
    RETURN true;
  END IF;

  -- Check if adding tokens would exceed limit
  IF (v_quota.usage->>'currentTokens')::integer + p_tokens_to_use > (v_quota.limits->>'maxTokensPerDay')::integer THEN
    RETURN false;
  END IF;

  -- Update token usage
  UPDATE quotas
  SET usage = jsonb_set(
    usage,
    '{currentTokens}',
    to_jsonb((usage->>'currentTokens')::integer + p_tokens_to_use)
  )
  WHERE user_id = p_user_id;

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to record payment
CREATE OR REPLACE FUNCTION record_payment(
  p_user_id uuid,
  p_amount integer,
  p_type text,
  p_stripe_payment_id text DEFAULT NULL
)
RETURNS void AS $$
BEGIN
  -- Insert payment record
  INSERT INTO payments (
    user_id,
    amount,
    status,
    type,
    stripe_payment_id
  ) VALUES (
    p_user_id,
    p_amount,
    'succeeded',
    p_type,
    p_stripe_payment_id
  );

  -- Update user's subscription or tokens
  IF p_type = 'subscription' THEN
    UPDATE users
    SET
      active_subscription = CASE
        WHEN p_amount >= 4999 THEN 'enterprise'
        ELSE 'basic'
      END,
      updated_at = now()
    WHERE id = p_user_id;
  ELSE
    -- $1 = 10 tokens
    UPDATE users
    SET
      tokens_used = tokens_used + (p_amount / 100) * 10,
      updated_at = now()
    WHERE id = p_user_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to increment tokens used
CREATE OR REPLACE FUNCTION increment_tokens_used(
  p_user_id uuid
)
RETURNS void AS $$
BEGIN
  UPDATE users
  SET
    tokens_used = tokens_used + 1,
    updated_at = now()
  WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to deduct tokens
CREATE OR REPLACE FUNCTION deduct_tokens(
  p_user_id uuid,
  p_amount integer
)
RETURNS void AS $$
DECLARE
  v_current_tokens integer;
BEGIN
  -- Get current tokens
  SELECT tokens_used INTO v_current_tokens
  FROM users
  WHERE id = p_user_id
  FOR UPDATE;

  IF v_current_tokens < p_amount THEN
    RAISE EXCEPTION 'Insufficient tokens';
  END IF;

  -- Deduct tokens
  UPDATE users
  SET
    tokens_used = tokens_used - p_amount,
    updated_at = now()
  WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;