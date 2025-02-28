/*
  # Enhance Memory System

  1. New Functions
    - get_chat_memories: Get all memories for a chat
    - get_user_memories: Get all memories for a user
    - get_relevant_memories_enhanced: Improved memory search with context

  2. Changes
    - Add memory_context column to memories table
    - Add memory_type_weight function for better relevance scoring
    - Add full text search capabilities
*/

-- Add memory_context column to memories table
ALTER TABLE memories
ADD COLUMN IF NOT EXISTS memory_context jsonb DEFAULT '{}';

-- Function to calculate memory type weight
CREATE OR REPLACE FUNCTION memory_type_weight(memory_type text)
RETURNS float AS $$
BEGIN
  RETURN CASE memory_type
    WHEN 'fact' THEN 1.0
    WHEN 'context' THEN 0.9
    WHEN 'preference' THEN 0.8
    WHEN 'personality' THEN 0.7
    ELSE 0.5
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Enhanced function to get relevant memories
CREATE OR REPLACE FUNCTION get_relevant_memories_enhanced(
  p_user_id uuid,
  p_chat_id uuid,
  p_content text,
  p_limit integer DEFAULT 5,
  p_min_confidence float DEFAULT 0.6
)
RETURNS TABLE (
  id uuid,
  content text,
  type text,
  category text,
  confidence float,
  relevance float,
  context jsonb
) AS $$
BEGIN
  RETURN QUERY
  WITH ranked_memories AS (
    SELECT 
      m.id,
      m.content,
      m.type,
      m.category,
      m.confidence,
      m.memory_context as context,
      (
        ts_rank_cd(to_tsvector('english', m.content), to_tsquery('english', format_search_terms(p_content)))
        * memory_type_weight(m.type)
        * m.confidence
      ) as relevance
    FROM memories m
    WHERE 
      m.user_id = p_user_id
      AND m.is_active = true
      AND m.confidence >= p_min_confidence
      AND (m.chat_id = p_chat_id OR m.chat_id IS NULL)
      AND (
        to_tsvector('english', m.content) @@ to_tsquery('english', format_search_terms(p_content))
        OR similarity(m.content, p_content) > 0.3
      )
  )
  SELECT 
    id,
    content,
    type,
    category,
    confidence,
    relevance,
    context
  FROM ranked_memories
  WHERE relevance > 0
  ORDER BY 
    relevance DESC,
    confidence DESC,
    id DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get all memories for a chat
CREATE OR REPLACE FUNCTION get_chat_memories(
  p_chat_id uuid,
  p_limit integer DEFAULT 100
)
RETURNS TABLE (
  id uuid,
  content text,
  type text,
  category text,
  confidence float,
  context jsonb,
  created_at timestamptz
) AS $$
BEGIN
  -- Ensure authenticated
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  RETURN QUERY
  SELECT 
    m.id,
    m.content,
    m.type,
    m.category,
    m.confidence,
    m.memory_context as context,
    m.created_at
  FROM memories m
  WHERE 
    m.user_id = auth.uid()
    AND m.chat_id = p_chat_id
    AND m.is_active = true
  ORDER BY m.created_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get all memories for a user
CREATE OR REPLACE FUNCTION get_user_memories(
  p_limit integer DEFAULT 100,
  p_type text DEFAULT NULL,
  p_category text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  content text,
  type text,
  category text,
  confidence float,
  context jsonb,
  created_at timestamptz
) AS $$
BEGIN
  -- Ensure authenticated
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  RETURN QUERY
  SELECT 
    m.id,
    m.content,
    m.type,
    m.category,
    m.confidence,
    m.memory_context as context,
    m.created_at
  FROM memories m
  WHERE 
    m.user_id = auth.uid()
    AND m.is_active = true
    AND (p_type IS NULL OR m.type = p_type)
    AND (p_category IS NULL OR m.category = p_category)
  ORDER BY 
    m.confidence DESC,
    m.created_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_relevant_memories_enhanced TO authenticated;
GRANT EXECUTE ON FUNCTION get_chat_memories TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_memories TO authenticated;