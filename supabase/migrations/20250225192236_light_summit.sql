/*
  # Fix Memories Schema

  1. Changes
    - Add missing columns to memories table
    - Update memory store schema
    - Add memory-related functions
    - Fix RLS policies

  2. Security
    - Enable RLS
    - Add policies for authenticated users
*/

-- Drop and recreate memories table with correct schema
DROP TABLE IF EXISTS memories CASCADE;

CREATE TABLE memories (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  chat_id uuid REFERENCES chats(id) ON DELETE CASCADE,
  content text NOT NULL,
  type text NOT NULL CHECK (type IN ('fact', 'preference', 'context', 'personality')),
  category text,
  confidence float NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  source text NOT NULL CHECK (source IN ('user', 'system', 'inference')),
  is_active boolean DEFAULT true,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add indexes
CREATE INDEX memories_user_id_confidence_idx ON memories(user_id, confidence DESC);
CREATE INDEX memories_chat_id_idx ON memories(chat_id);
CREATE INDEX memories_content_gin_idx ON memories USING gin(to_tsvector('english', content));

-- Enable RLS
ALTER TABLE memories ENABLE ROW LEVEL SECURITY;

-- Add RLS policies
CREATE POLICY "Users can read own memories"
  ON memories
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can create own memories"
  ON memories
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own memories"
  ON memories
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own memories"
  ON memories
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Function to add a memory
CREATE OR REPLACE FUNCTION add_memory(
  p_content text,
  p_type text,
  p_category text,
  p_confidence float,
  p_source text,
  p_chat_id uuid DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'
)
RETURNS memories AS $$
DECLARE
  v_memory memories;
BEGIN
  -- Ensure authenticated
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Insert memory
  INSERT INTO memories (
    user_id,
    chat_id,
    content,
    type,
    category,
    confidence,
    source,
    metadata
  )
  VALUES (
    auth.uid(),
    p_chat_id,
    p_content,
    p_type,
    p_category,
    p_confidence,
    p_source,
    p_metadata
  )
  RETURNING * INTO v_memory;

  -- Update memory store count
  INSERT INTO memory_stores (
    user_id,
    memory_count
  )
  VALUES (
    auth.uid(),
    1
  )
  ON CONFLICT (user_id)
  DO UPDATE SET
    memory_count = memory_stores.memory_count + 1,
    updated_at = now();

  RETURN v_memory;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get relevant memories
CREATE OR REPLACE FUNCTION get_relevant_memories(
  p_chat_id uuid,
  p_content text,
  p_limit integer DEFAULT 5,
  p_min_confidence float DEFAULT 0.6
)
RETURNS SETOF memories AS $$
BEGIN
  -- Ensure authenticated
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  RETURN QUERY
  SELECT m.*
  FROM memories m
  WHERE m.user_id = auth.uid()
    AND m.is_active = true
    AND m.confidence >= p_min_confidence
    AND (m.chat_id = p_chat_id OR m.chat_id IS NULL)
    AND to_tsvector('english', m.content) @@ to_tsquery('english', regexp_replace(p_content, '\s+', ' & ', 'g'))
  ORDER BY m.confidence DESC, m.created_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.add_memory(text, text, text, float, text, uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_relevant_memories(uuid, text, integer, float) TO authenticated;