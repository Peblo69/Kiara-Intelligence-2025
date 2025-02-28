/*
  # Fix Streaming Message Handling

  1. Changes
    - Add proper handling of streaming messages
    - Fix empty content issue with streaming messages
    - Add cleanup of stale streaming messages
    - Add proper message state transitions

  2. Security
    - Maintain existing RLS policies
    - Add validation for message state changes
*/

-- Function to safely handle streaming messages
CREATE OR REPLACE FUNCTION handle_streaming_message(
  p_chat_id uuid,
  p_user_id uuid,
  p_content text,
  p_role text,
  p_is_streaming boolean DEFAULT false
)
RETURNS messages AS $$
DECLARE
  v_message messages;
  v_existing_message messages;
BEGIN
  -- Check for existing streaming message
  SELECT * INTO v_existing_message
  FROM messages
  WHERE chat_id = p_chat_id
    AND role = 'assistant'
    AND is_streaming = true
  ORDER BY created_at DESC
  LIMIT 1;

  IF FOUND AND p_is_streaming THEN
    -- Update existing streaming message
    UPDATE messages
    SET 
      content = p_content,
      updated_at = now()
    WHERE id = v_existing_message.id
    RETURNING * INTO v_message;
  ELSE
    -- Insert new message
    INSERT INTO messages (
      chat_id,
      user_id,
      content,
      role,
      is_streaming,
      error,
      created_at,
      updated_at
    )
    VALUES (
      p_chat_id,
      p_user_id,
      COALESCE(p_content, ''),
      p_role,
      p_is_streaming,
      false,
      now(),
      now()
    )
    RETURNING * INTO v_message;

    -- Update chat metadata
    UPDATE chats
    SET
      message_count = message_count + 1,
      last_message = CASE 
        WHEN p_role = 'assistant' AND NOT p_is_streaming THEN p_content
        ELSE last_message
      END,
      updated_at = now()
    WHERE id = p_chat_id;
  END IF;

  RETURN v_message;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to finalize streaming message
CREATE OR REPLACE FUNCTION finalize_streaming_message(
  p_message_id uuid,
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
    AND is_streaming = true
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Message not found or not in streaming state';
  END IF;

  -- Update message
  UPDATE messages
  SET 
    content = p_content,
    is_streaming = false,
    updated_at = now()
  WHERE id = p_message_id
  RETURNING * INTO v_message;

  -- Update chat
  UPDATE chats
  SET
    last_message = p_content,
    updated_at = now()
  WHERE id = v_chat_id;

  RETURN v_message;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to cleanup stale streaming messages
CREATE OR REPLACE FUNCTION cleanup_stale_streaming_messages(p_minutes integer DEFAULT 5)
RETURNS void AS $$
BEGIN
  UPDATE messages
  SET
    is_streaming = false,
    content = CASE 
      WHEN content = '' OR content IS NULL THEN '*Message generation interrupted*'
      ELSE content || '\n\n*Message generation interrupted*'
    END,
    updated_at = now()
  WHERE is_streaming = true
    AND updated_at < now() - (p_minutes || ' minutes')::interval;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update message handling function
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

  -- Handle message
  RETURN handle_streaming_message(
    chat_id,
    auth.uid(),
    content,
    role,
    is_streaming
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update message streaming state function
CREATE OR REPLACE FUNCTION public.update_message_streaming_state(
  p_message_id uuid,
  p_is_streaming boolean,
  p_content text
)
RETURNS messages AS $$
BEGIN
  -- Ensure authenticated
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Finalize message if stopping streaming
  IF NOT p_is_streaming THEN
    RETURN finalize_streaming_message(p_message_id, p_content);
  END IF;

  -- Update streaming message
  RETURN handle_streaming_message(
    (SELECT chat_id FROM messages WHERE id = p_message_id),
    auth.uid(),
    p_content,
    'assistant',
    true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create scheduled job to cleanup stale streaming messages
CREATE OR REPLACE FUNCTION schedule_streaming_cleanup()
RETURNS void AS $$
BEGIN
  PERFORM cleanup_stale_streaming_messages();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.add_message(uuid, text, text, boolean, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_message_streaming_state(uuid, boolean, text) TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_stale_streaming_messages(integer) TO authenticated;