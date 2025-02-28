/*
  # Add message procedure and RPC function

  1. New Functions
    - add_message_with_chat_update: Adds a message and updates chat metadata
    - get_chat_messages: Gets messages for a chat with pagination

  2. Security
    - Functions are SECURITY DEFINER to run with elevated privileges
    - Input validation included
    - Transaction handling for data consistency

  3. Changes
    - Adds RPC function for client usage
    - Updates chat metadata (message count, last message)
    - Handles streaming and error states
*/

-- Function to add a message and update chat metadata
CREATE OR REPLACE FUNCTION add_message_with_chat_update(
  p_chat_id uuid,
  p_user_id uuid,
  p_content text,
  p_role text,
  p_is_streaming boolean DEFAULT false,
  p_error boolean DEFAULT false
)
RETURNS messages AS $$
DECLARE
  v_message messages;
  v_chat chats;
BEGIN
  -- Verify chat exists and belongs to user
  SELECT * INTO v_chat
  FROM chats
  WHERE id = p_chat_id AND user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Chat not found or unauthorized';
  END IF;

  -- Insert message
  INSERT INTO messages (
    chat_id,
    user_id,
    content,
    role,
    is_streaming,
    error
  )
  VALUES (
    p_chat_id,
    p_user_id,
    p_content,
    p_role,
    p_is_streaming,
    p_error
  )
  RETURNING * INTO v_message;

  -- Update chat metadata
  UPDATE chats
  SET
    message_count = message_count + 1,
    last_message = CASE 
      WHEN p_role = 'assistant' AND NOT p_error THEN p_content
      ELSE last_message
    END,
    updated_at = now()
  WHERE id = p_chat_id;

  RETURN v_message;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create RPC function for client usage
CREATE OR REPLACE FUNCTION public.add_message(
  chat_id uuid,
  content text,
  role text,
  is_streaming boolean DEFAULT false,
  error boolean DEFAULT false
)
RETURNS messages AS $$
BEGIN
  -- Ensure authenticated
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Call internal function
  RETURN add_message_with_chat_update(
    chat_id,
    auth.uid(),
    content,
    role,
    is_streaming,
    error
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get chat messages with pagination
CREATE OR REPLACE FUNCTION get_chat_messages(
  p_chat_id uuid,
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS SETOF messages AS $$
BEGIN
  -- Ensure authenticated
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Verify chat belongs to user
  IF NOT EXISTS (
    SELECT 1 FROM chats 
    WHERE id = p_chat_id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Chat not found or unauthorized';
  END IF;

  -- Return messages
  RETURN QUERY
  SELECT *
  FROM messages
  WHERE chat_id = p_chat_id
  ORDER BY created_at ASC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.add_message(uuid, text, text, boolean, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_chat_messages(uuid, integer, integer) TO authenticated;