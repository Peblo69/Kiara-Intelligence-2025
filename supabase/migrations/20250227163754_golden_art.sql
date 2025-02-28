/*
  # Fix increment_counter function parameter handling

  1. Changes
     - Drop and recreate the increment_counter function with proper parameter handling
     - Add direct memory store update function to avoid parameter confusion
     - Improve error handling and failure recovery

  2. Security
     - Keep SECURITY DEFINER to maintain admin privileges
     - Maintain existing function visibility
*/

-- First completely drop increment_counter to avoid parameter conflicts
DROP FUNCTION IF EXISTS increment_counter(uuid);

-- Create a new, more robust increment_counter function that properly handles user_id
CREATE OR REPLACE FUNCTION increment_counter(user_id uuid)
RETURNS integer AS $$
DECLARE
  v_memory_count integer := 0;
BEGIN
  -- Check if record exists
  SELECT memory_count INTO v_memory_count
  FROM memory_stores
  WHERE memory_stores.user_id = increment_counter.user_id
  FOR UPDATE;

  -- Create or update record
  IF NOT FOUND THEN
    -- Create new record
    INSERT INTO memory_stores (
      user_id,
      memory_count,
      last_processed
    )
    VALUES (
      user_id,
      1,
      now()
    )
    RETURNING memory_count INTO v_memory_count;
  ELSE
    -- Update existing record
    UPDATE memory_stores
    SET 
      memory_count = memory_count + 1,
      last_processed = now(),
      updated_at = now()
    WHERE memory_stores.user_id = increment_counter.user_id
    RETURNING memory_count INTO v_memory_count;
  END IF;

  RETURN v_memory_count;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error
    RAISE NOTICE 'Error in increment_counter: %', SQLERRM;
    -- Return 0 to avoid breaking functionality
    RETURN 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a safer direct memory store update function
CREATE OR REPLACE FUNCTION update_memory_store(
  p_user_id uuid,
  p_increment integer DEFAULT 1
)
RETURNS integer AS $$
DECLARE
  v_memory_count integer := 0;
BEGIN
  -- Insert or update memory store
  INSERT INTO memory_stores (
    user_id,
    memory_count,
    last_processed
  )
  VALUES (
    p_user_id,
    p_increment,
    now()
  )
  ON CONFLICT (user_id)
  DO UPDATE SET
    memory_count = memory_stores.memory_count + p_increment,
    last_processed = now(),
    updated_at = now()
  RETURNING memory_count INTO v_memory_count;

  RETURN v_memory_count;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error
    RAISE NOTICE 'Error in update_memory_store: %', SQLERRM;
    -- Return 0 to avoid breaking functionality
    RETURN 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update memory-related functions to use the safer direct approach
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

  -- Use the safer direct function for updating memory store
  PERFORM update_memory_store(p_user_id, 1);

  RETURN v_memory;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Public API for adding memory that uses the new functions
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
GRANT EXECUTE ON FUNCTION increment_counter(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION update_memory_store(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_memory(text, text, text, float, text, uuid, jsonb) TO authenticated;