-- Drop existing function first to avoid parameter conflict
DROP FUNCTION IF EXISTS increment_counter(uuid);

-- Create a new version of the increment_counter function
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
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error in increment_counter: %', SQLERRM;
    RETURN 1; -- Return 1 as fallback
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update memory store SQL in existing functions to avoid using increment_counter
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

  -- Update memory store count directly
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