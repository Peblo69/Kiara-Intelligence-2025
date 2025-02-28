-- Function to deduct user tokens
CREATE OR REPLACE FUNCTION deduct_user_tokens(
  p_user_id uuid,
  p_amount integer,
  p_reason text DEFAULT 'usage'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_tokens integer;
  v_transaction_id uuid;
BEGIN
  -- Get current tokens with lock
  SELECT tokens_used INTO v_current_tokens
  FROM users
  WHERE id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  -- Check if user has enough tokens
  IF v_current_tokens < p_amount THEN
    RAISE EXCEPTION 'Insufficient tokens';
  END IF;

  -- Deduct tokens
  UPDATE users
  SET 
    tokens_used = tokens_used - p_amount,
    updated_at = now()
  WHERE id = p_user_id;

  -- Record transaction
  INSERT INTO token_transactions (
    user_id,
    amount,
    reason,
    metadata
  )
  VALUES (
    p_user_id,
    -p_amount,
    p_reason,
    jsonb_build_object(
      'type', 'usage',
      'description', 'Token deduction for message',
      'previous_balance', v_current_tokens
    )
  )
  RETURNING id INTO v_transaction_id;

  -- Return updated info
  RETURN jsonb_build_object(
    'success', true,
    'previous_balance', v_current_tokens,
    'new_balance', v_current_tokens - p_amount,
    'transaction_id', v_transaction_id
  );
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION deduct_user_tokens TO authenticated;