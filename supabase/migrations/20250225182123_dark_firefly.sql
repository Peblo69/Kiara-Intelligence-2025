/*
  # Add Message Function

  1. Function Description
    - Adds a new message to a chat
    - Updates chat's message count and last message
    - Returns the created message ID

  2. Parameters
    - p_chat_id: Chat UUID
    - p_user_id: User UUID
    - p_content: Message content
    - p_role: Message role ('user' or 'assistant')
    - p_is_streaming: Streaming status
    - p_error: Error status

  3. Returns
    - The created message record
*/

CREATE OR REPLACE FUNCTION add_message(
  p_chat_id uuid,
  p_user_id uuid,
  p_content text,
  p_role text,
  p_is_streaming boolean,
  p_error boolean
)
RETURNS messages AS $$
DECLARE
  v_message messages;
BEGIN
  -- Insert the message
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
    last_message = p_content,
    updated_at = now()
  WHERE id = p_chat_id;

  RETURN v_message;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;