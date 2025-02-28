/*
  # Fix Chat Creation Process

  1. Changes
    - Add stored procedure for safe chat creation
    - Add validation checks for user existence
    - Add automatic user initialization if needed

  2. Security
    - Ensures user exists before chat creation
    - Maintains data integrity
    - Handles edge cases safely
*/

-- Function to safely create a new chat
CREATE OR REPLACE FUNCTION create_chat(
  p_user_id uuid,
  p_title text,
  p_model text
)
RETURNS chats AS $$
DECLARE
  v_user users;
  v_chat chats;
BEGIN
  -- Check if user exists
  SELECT * INTO v_user
  FROM users
  WHERE id = p_user_id
  FOR UPDATE;

  -- If user doesn't exist, create them
  IF NOT FOUND THEN
    INSERT INTO users (
      id,
      email,
      display_name,
      tokens_used,
      active_subscription
    )
    VALUES (
      p_user_id,
      auth.email(),
      COALESCE(auth.email(), 'User')::text,
      0,
      'free'
    )
    RETURNING * INTO v_user;
  END IF;

  -- Create the chat
  INSERT INTO chats (
    user_id,
    title,
    model,
    message_count,
    last_message
  )
  VALUES (
    p_user_id,
    p_title,
    p_model,
    0,
    NULL
  )
  RETURNING * INTO v_chat;

  RETURN v_chat;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create RPC function for client usage
CREATE OR REPLACE FUNCTION public.create_new_chat(
  title text,
  model text
)
RETURNS chats AS $$
BEGIN
  -- Ensure authenticated
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Call internal function
  RETURN create_chat(
    auth.uid(),
    title,
    model
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.create_new_chat(text, text) TO authenticated;