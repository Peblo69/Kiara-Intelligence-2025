/*
  # Initial Schema Setup for Kiara Chat Application

  1. New Tables
    - `users`
      - Core user information and authentication
      - Tracks subscription status and token usage
    - `chats`
      - Chat sessions with model type and metadata
    - `messages`
      - Individual chat messages with content and role
    - `memories`
      - User-specific memory storage for context
    - `memory_stores`
      - Metadata about user's memory collection
    - `preferences`
      - User preferences and settings
    - `quotas`
      - User usage limits and quotas
    - `analytics`
      - Usage analytics and metrics
    - `payments`
      - Payment and subscription records

  2. Security
    - RLS enabled on all tables
    - Policies for authenticated access
    - User-specific data isolation

  3. Indexes
    - Optimized queries for chat history
    - Memory relevance searching
    - Analytics aggregation
*/

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  email text UNIQUE NOT NULL,
  display_name text NOT NULL,
  avatar_url text,
  tokens_used integer DEFAULT 0,
  active_subscription text DEFAULT 'free',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own data"
  ON users
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own data"
  ON users
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

-- Chats table
CREATE TABLE IF NOT EXISTS chats (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  title text NOT NULL,
  model text NOT NULL CHECK (model IN ('dominator', 'vision')),
  last_message text,
  message_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE chats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own chats"
  ON chats
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid());

CREATE INDEX chats_user_id_updated_at_idx ON chats(user_id, updated_at DESC);

-- Messages table
CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  chat_id uuid REFERENCES chats(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  content text NOT NULL,
  role text NOT NULL CHECK (role IN ('user', 'assistant')),
  is_streaming boolean DEFAULT false,
  error boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own messages"
  ON messages
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid());

CREATE INDEX messages_chat_id_created_at_idx ON messages(chat_id, created_at);

-- Memory stores table
CREATE TABLE IF NOT EXISTS memory_stores (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  memory_count integer DEFAULT 0,
  last_processed timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE memory_stores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own memory store"
  ON memory_stores
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid());

-- Memories table
CREATE TABLE IF NOT EXISTS memories (
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

ALTER TABLE memories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own memories"
  ON memories
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid());

CREATE INDEX memories_user_id_confidence_idx ON memories(user_id, confidence DESC);
CREATE INDEX memories_chat_id_idx ON memories(chat_id);
CREATE INDEX memories_content_gin_idx ON memories USING gin(to_tsvector('english', content));

-- Preferences table
CREATE TABLE IF NOT EXISTS preferences (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  theme text DEFAULT 'dark',
  font_size integer DEFAULT 14,
  language text DEFAULT 'en',
  notifications jsonb DEFAULT '{"email": true, "push": true, "desktop": true}',
  ai_preferences jsonb DEFAULT '{"defaultModel": "dominator", "temperature": 0.7, "maxTokens": 2048}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own preferences"
  ON preferences
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid());

-- Quotas table
CREATE TABLE IF NOT EXISTS quotas (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  plan text DEFAULT 'free',
  limits jsonb DEFAULT '{"maxChats": 10, "maxTokensPerDay": 1000, "maxMemories": 50, "maxFileSize": 5242880}',
  usage jsonb DEFAULT '{"currentTokens": 0}',
  period_start timestamptz DEFAULT now(),
  period_end timestamptz DEFAULT now() + interval '1 day',
  reset_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE quotas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own quotas"
  ON quotas
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Analytics table
CREATE TABLE IF NOT EXISTS analytics (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  chat_id uuid REFERENCES chats(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('chat', 'vision', 'memory')),
  metrics jsonb NOT NULL,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE analytics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own analytics"
  ON analytics
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can create own analytics"
  ON analytics
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Payments table
CREATE TABLE IF NOT EXISTS payments (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  amount integer NOT NULL,
  currency text DEFAULT 'USD',
  status text NOT NULL CHECK (status IN ('pending', 'succeeded', 'failed')),
  type text NOT NULL CHECK (type IN ('subscription', 'tokens')),
  stripe_payment_id text,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own payments"
  ON payments
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can create own payments"
  ON payments
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Functions
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_chats_updated_at
  BEFORE UPDATE ON chats
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_memory_stores_updated_at
  BEFORE UPDATE ON memory_stores
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_memories_updated_at
  BEFORE UPDATE ON memories
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_preferences_updated_at
  BEFORE UPDATE ON preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_quotas_updated_at
  BEFORE UPDATE ON quotas
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();