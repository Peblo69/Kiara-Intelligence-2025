-- Drop existing functions first
DROP FUNCTION IF EXISTS public.add_message(uuid, text, text, boolean, boolean);
DROP FUNCTION IF EXISTS public.update_message_streaming_state(uuid, boolean, text);

-- Function to add a message with proper streaming state
CREATE OR REPLACE FUNCTION add_message_with_streaming(
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

  -- Check for existing streaming message
  IF p_role = 'assistant' AND p_is_streaming THEN
    UPDATE messages
    SET content = p_content,
        updated_at = now()
    WHERE chat_id = p_chat_id
      AND role = 'assistant'
      AND is_streaming = true
    RETURNING * INTO v_message;
    
    IF FOUND THEN
      RETURN v_message;
    END IF;
  END IF;

  -- Insert new message
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

-- Function to update message streaming state
CREATE OR REPLACE FUNCTION update_message_streaming_state(
  p_message_id uuid,
  p_is_streaming boolean,
  p_content text
)
RETURNS messages AS $$
DECLARE
  v_message messages;
  v_chat_id uuid;
BEGIN
  -- Get message and chat info
  SELECT id, chat_id INTO v_message.id, v_chat_id
  FROM messages
  WHERE id = p_message_id
    AND user_id = auth.uid()
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Message not found or unauthorized';
  END IF;

  -- Update message
  UPDATE messages
  SET 
    content = p_content,
    is_streaming = p_is_streaming,
    updated_at = now()
  WHERE id = p_message_id
  RETURNING * INTO v_message;

  -- Update chat if message is complete
  IF NOT p_is_streaming THEN
    UPDATE chats
    SET
      last_message = p_content,
      updated_at = now()
    WHERE id = v_chat_id;
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
  -- Ensure authenticated
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  RETURN add_message_with_streaming(
    chat_id,
    auth.uid(),
    content,
    role,
    is_streaming,
    error
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.add_message(uuid, text, text, boolean, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_message_streaming_state(uuid, boolean, text) TO authenticated;