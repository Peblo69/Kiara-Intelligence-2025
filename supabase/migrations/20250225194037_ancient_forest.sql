/*
  # Fix Memory Search Function

  1. Changes
    - Fix ambiguous column reference in relevance sorting
    - Improve memory ranking logic
    - Add proper column aliases
    - Maintain security settings

  2. Security
    - Keep existing RLS policies
    - Maintain SECURITY DEFINER setting
*/

-- Drop existing function first
DROP FUNCTION IF EXISTS get_relevant_memories(uuid, text, integer, double precision);

-- Function to safely format search terms
CREATE OR REPLACE FUNCTION format_search_terms(search_text text)
RETURNS text AS $$
DECLARE
  formatted_text text;
BEGIN
  -- Remove special characters and extra spaces
  formatted_text := regexp_replace(search_text, '[^a-zA-Z0-9\s]', ' ', 'g');
  -- Replace multiple spaces with single space
  formatted_text := regexp_replace(formatted_text, '\s+', ' ', 'g');
  -- Trim spaces
  formatted_text := trim(formatted_text);
  -- Replace spaces with &
  formatted_text := regexp_replace(formatted_text, '\s+', ' & ', 'g');
  -- Add :* to each term for prefix matching
  formatted_text := regexp_replace(formatted_text, '([^\s&]+)', '\1:*', 'g');
  
  RETURN formatted_text;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Updated function to get relevant memories with better search
CREATE OR REPLACE FUNCTION get_relevant_memories(
  p_chat_id uuid,
  p_content text,
  p_limit integer DEFAULT 5,
  p_min_confidence float DEFAULT 0.6
)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  chat_id uuid,
  content text,
  type text,
  category text,
  confidence float,
  source text,
  is_active boolean,
  metadata jsonb,
  created_at timestamptz,
  updated_at timestamptz,
  relevance float
) AS $$
DECLARE
  search_terms text;
BEGIN
  -- Input validation
  IF p_content IS NULL OR trim(p_content) = '' THEN
    RETURN;
  END IF;

  -- Format search terms
  search_terms := format_search_terms(p_content);

  -- Ensure we have valid search terms
  IF search_terms IS NULL OR trim(search_terms) = '' THEN
    RETURN;
  END IF;

  -- First try text search
  RETURN QUERY
  SELECT 
    m.id,
    m.user_id,
    m.chat_id,
    m.content,
    m.type,
    m.category,
    m.confidence,
    m.source,
    m.is_active,
    m.metadata,
    m.created_at,
    m.updated_at,
    ts_rank_cd(to_tsvector('english', m.content), to_tsquery('english', search_terms))::float AS relevance
  FROM memories m
  WHERE 
    m.user_id = auth.uid()
    AND m.is_active = true
    AND m.confidence >= p_min_confidence
    AND (m.chat_id = p_chat_id OR m.chat_id IS NULL)
    AND to_tsvector('english', m.content) @@ to_tsquery('english', search_terms)
  ORDER BY 
    ts_rank_cd(to_tsvector('english', m.content), to_tsquery('english', search_terms)) DESC,
    m.confidence DESC,
    m.created_at DESC
  LIMIT p_limit;

  -- If no results with text search, try fuzzy matching
  IF NOT FOUND THEN
    RETURN QUERY
    SELECT 
      m.id,
      m.user_id,
      m.chat_id,
      m.content,
      m.type,
      m.category,
      m.confidence,
      m.source,
      m.is_active,
      m.metadata,
      m.created_at,
      m.updated_at,
      similarity(m.content, p_content)::float AS relevance
    FROM memories m
    WHERE 
      m.user_id = auth.uid()
      AND m.is_active = true
      AND m.confidence >= p_min_confidence
      AND (m.chat_id = p_chat_id OR m.chat_id IS NULL)
      AND similarity(m.content, p_content) > 0.3
    ORDER BY 
      similarity(m.content, p_content) DESC,
      m.confidence DESC,
      m.created_at DESC
    LIMIT p_limit;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enable pg_trgm extension for fuzzy matching
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.get_relevant_memories(uuid, text, integer, float) TO authenticated;