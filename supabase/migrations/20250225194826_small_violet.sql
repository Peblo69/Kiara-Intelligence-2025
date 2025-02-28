/*
  # Fix add_memory function signature

  1. Changes
    - Drop existing function before recreating
    - Fix parameter types
    - Maintain existing functionality

  2. Security
    - Maintain existing security policies
*/

-- Drop existing functions first
DROP FUNCTION IF EXISTS public.add_memory(text, text, text, double precision, text, uuid, jsonb);
DROP FUNCTION IF EXISTS add_memory_with_validation(uuid, uuid, text, text, text, double precision, text, jsonb);

-- Recreate the function with proper types
CREATE OR REPLACE FUNCTION add_memory_with_validation(
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
  -- Input validation
  IF p_content IS NULL OR trim(p_content) = '' THEN
    RAISE EXCEPTION 'Memory content cannot be empty';
  END IF;

  IF p_confidence < 0 OR p_confidence > 1 THEN
    RAISE EXCEPTION 'Confidence must be between 0 and 1';
  END IF;

  -- Insert memory with proper transaction handling
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

  RETURN add_memory_with_validation(
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
GRANT EXECUTE ON FUNCTION public.add_memory(text, text, text, float, text, uuid, jsonb) TO authenticated;