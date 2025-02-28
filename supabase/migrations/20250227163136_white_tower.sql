/*
  # Fix memory store and counter functions

  1. Changes
    - Fix increment_counter function to handle UUID properly
    - Add proper error handling
    - Improve memory store operations
    
  2. Security
    - Maintain RLS policies
    - Keep security checks
*/

-- Drop existing function if it exists
DROP FUNCTION IF EXISTS increment_counter(uuid);

-- Create improved increment counter function
CREATE OR REPLACE FUNCTION increment_counter(p_user_id uuid)
RETURNS integer AS $$
DECLARE
  v_count integer;
BEGIN
  -- Get current count or initialize
  SELECT memory_count INTO v_count
  FROM memory_stores
  WHERE user_id = p_user_id;

  IF NOT FOUND THEN
    -- Initialize memory store if it doesn't exist
    INSERT INTO memory_stores (
      user_id,
      memory_count,
      last_processed
    )
    VALUES (
      p_user_id,
      1,
      now()
    )
    RETURNING memory_count INTO v_count;
  ELSE
    -- Update existing count
    UPDATE memory_stores
    SET 
      memory_count = memory_count + 1,
      last_processed = now(),
      updated_at = now()
    WHERE user_id = p_user_id
    RETURNING memory_count INTO v_count;
  END IF;

  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to safely add memory with store update
CREATE OR REPLACE FUNCTION add_memory_with_store_update(
  p_user_id uuid,
  p_chat_id uuid,
  p_content text,
  p_type text,
  p_category text,
  p_confidence float,
  p_source text,
  p_metadata jsonb DEFAULT '{}'
)
RETURNS memories AS $$
DECLARE
  v_memory memories;
BEGIN
  -- Insert memory
  INSERT INTO memories (
    user_id,
    chat_id,
    content,
    type,
    category,
    confidence,
    source,
    metadata,
    is_active
  )
  VALUES (
    p_user_id,
    p_chat_id,
    p_content,
    p_type,
    p_category,
    p_confidence,
    p_source,
    p_metadata,
    true
  )
  RETURNING * INTO v_memory;

  -- Update memory store count
  PERFORM increment_counter(p_user_id);

  RETURN v_memory;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create public wrapper for memory addition
CREATE OR REPLACE FUNCTION public.add_memory(
  content text,
  type text,
  category text,
  confidence float,
  source text,
  chat_id uuid DEFAULT NULL,
  metadata jsonb DEFAULT '{}'
)
RETURNS memories AS $$
BEGIN
  -- Ensure authenticated
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  RETURN add_memory_with_store_update(
    auth.uid(),
    chat_id,
    content,
    type,
    category,
    confidence,
    source,
    metadata
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION increment_counter TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_memory TO authenticated;