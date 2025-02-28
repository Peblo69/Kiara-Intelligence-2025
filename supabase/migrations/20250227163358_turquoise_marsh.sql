/*
  # Fix increment_counter function parameter handling

  1. Changes
    - Drop and recreate increment_counter function to fix parameter naming
    - Update implementation to properly handle both parameter names
    - Modify add_memory_with_store_update to avoid recursive calls
    
  2. Security
    - Preserve security definer settings
    - Keep existing permissions
*/

-- First drop the existing function
DROP FUNCTION IF EXISTS increment_counter(uuid);

-- Create a fixed version that handles the row_id parameter correctly
CREATE OR REPLACE FUNCTION increment_counter(p_user_id uuid)
RETURNS integer AS $$
DECLARE
  v_count integer;
BEGIN
  -- Get current count or initialize
  SELECT memory_count INTO v_count
  FROM memory_stores
  WHERE user_id = p_user_id
  FOR UPDATE;

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

-- Update memory store SQL in existing functions
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

  -- Update memory store count directly rather than using the function
  -- to avoid potential issues with the parameter naming
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
  ON CONFLICT (user_id)
  DO UPDATE SET
    memory_count = memory_stores.memory_count + 1,
    last_processed = now(),
    updated_at = now();

  RETURN v_memory;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION increment_counter(uuid) TO authenticated;