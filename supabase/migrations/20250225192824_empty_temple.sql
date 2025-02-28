/*
  # Fix Messages and Chat Functions

  1. Changes
    - Add proper message handling functions
    - Fix SQL syntax errors
    - Add proper chat metadata updates
    - Add message streaming support

  2. Security
    - Maintain RLS policies
    - Add proper user verification
*/

-- Function to safely add a message with proper persistence
CREATE OR REPLACE FUNCTION add_message_with_persistence(
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

  -- Insert message with proper persistence
  INSERT INTO messages (
    chat_id,
    user_id,
    content,
    role,
    is_streaming,
    error,
    created_at
  )
  VALUES (
    p_chat_id,
    p_user_id,
    p_content,
    p_role,
    p_is_streaming,
    p_error,
    now()
  )
  RETURNING * INTO v_message;

  -- Update chat metadata
  UPDATE chats
  SET
    message_count = message_count + 1,
    last_message = CASE 
      WHEN p_role = 'assistant' AND NOT p_error AND NOT p_is_streaming THEN p_content
      ELSE last_message
    END,
    updated_at = now()
  WHERE id = p_chat_id;

  RETURN v_message;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get chat messages with proper ordering
CREATE OR REPLACE FUNCTION get_chat_messages_ordered(
  p_chat_id uuid,
  p_page_size integer DEFAULT 100,
  p_page_offset integer DEFAULT 0
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

  -- Return messages in correct order
  RETURN QUERY
  SELECT m.*
  FROM messages m
  WHERE m.chat_id = p_chat_id
  ORDER BY m.created_at ASC, m.id ASC
  LIMIT p_page_size
  OFFSET p_page_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update message streaming state
CREATE OR REPLACE FUNCTION update_message_streaming_state(
  p_message_id uuid,
  p_is_streaming boolean,
  p_content text DEFAULT NULL
)
RETURNS messages AS $$
DECLARE
  v_message messages;
BEGIN
  -- Ensure authenticated
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Update message
  UPDATE messages
  SET
    is_streaming = p_is_streaming,
    content = COALESCE(p_content, content)
  WHERE id = p_message_id
    AND user_id = auth.uid()
  RETURNING * INTO v_message;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Message not found or unauthorized';
  END IF;

  -- Update chat if message is complete
  IF NOT p_is_streaming AND p_content IS NOT NULL THEN
    UPDATE chats
    SET
      last_message = p_content,
      updated_at = now()
    WHERE id = v_message.chat_id;
  END IF;

  RETURN v_message;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create RPC functions for client usage
CREATE OR REPLACE FUNCTION public.add_message(
  chat_id uuid,
  content text,
  role text,
  is_streaming boolean DEFAULT false,
  error boolean DEFAULT false
)
RETURNS messages AS $$
BEGIN
  RETURN add_message_with_persistence(
    chat_id,
    auth.uid(),
    content,
    role,
    is_streaming,
    error
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.get_messages(
  chat_id uuid,
  page_size integer DEFAULT 100,
  page_offset integer DEFAULT 0
)
RETURNS SETOF messages AS $$
BEGIN
  RETURN QUERY SELECT * FROM get_chat_messages_ordered(chat_id, page_size, page_offset);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.add_message(uuid, text, text, boolean, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_messages(uuid, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_message_streaming_state(uuid, boolean, text) TO authenticated;