/*
  # Token System Update

  1. Changes
    - Add last_token_reset column to users table
    - Create token_transactions table if not exists
    - Create memory_stores table if not exists
    - Add functions for token management
    - Add RLS policies with proper checks

  2. Features
    - Users get 80 tokens on signup
    - Tokens only reset after 24 hours if below 80
    - Track all token transactions
    - Initialize memory store for each user
*/

-- Create token_transactions table if it doesn't exist
CREATE TABLE IF NOT EXISTS token_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  amount integer NOT NULL,
  reason text NOT NULL CHECK (reason IN ('purchase', 'admin', 'usage', 'subscription', 'bonus')),
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- Create memory_stores table if it doesn't exist
CREATE TABLE IF NOT EXISTS memory_stores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  memory_count integer DEFAULT 0,
  last_processed timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add last_token_reset column to users table
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS last_token_reset timestamptz DEFAULT now();

-- Enable RLS on new tables
ALTER TABLE token_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE memory_stores ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own token transactions" ON token_transactions;
DROP POLICY IF EXISTS "Users can view own memory store" ON memory_stores;

-- Add RLS policies
CREATE POLICY "Users can view own token transactions"
  ON token_transactions
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can view own memory store"
  ON memory_stores
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Function to initialize memory store
CREATE OR REPLACE FUNCTION init_memory_store(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO memory_stores (
    user_id,
    memory_count,
    last_processed
  )
  VALUES (
    p_user_id,
    0,
    now()
  )
  ON CONFLICT (user_id) DO NOTHING;
END;
$$;

-- Update user profile creation to include initial tokens and memory store
CREATE OR REPLACE FUNCTION auth.create_user_profile() 
RETURNS trigger 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql 
AS $$
DECLARE
  retries integer := 0;
  max_retries constant integer := 3;
  success boolean := false;
  initial_tokens constant integer := 80;
BEGIN
  WHILE retries < max_retries AND NOT success LOOP
    BEGIN
      -- Create user profile with initial tokens
      INSERT INTO public.users (
        id,
        email,
        display_name,
        tokens_used,
        active_subscription,
        last_token_reset,
        created_at,
        updated_at
      ) VALUES (
        NEW.id,
        NEW.email,
        split_part(NEW.email, '@', 1),
        initial_tokens,
        'free',
        now(),
        NOW(),
        NOW()
      );

      -- Record initial token grant
      INSERT INTO token_transactions (
        user_id,
        amount,
        reason,
        metadata
      ) VALUES (
        NEW.id,
        initial_tokens,
        'bonus',
        jsonb_build_object(
          'type', 'initial_grant',
          'description', 'Initial token grant for new user'
        )
      );

      -- Initialize memory store
      PERFORM init_memory_store(NEW.id);

      -- Create preferences
      INSERT INTO public.preferences (
        user_id,
        theme,
        font_size,
        language,
        notifications,
        ai_preferences
      ) VALUES (
        NEW.id,
        'dark',
        14,
        'en',
        jsonb_build_object(
          'email', true,
          'push', true,
          'desktop', true
        ),
        jsonb_build_object(
          'defaultModel', 'dominator',
          'temperature', 0.7,
          'maxTokens', 2048
        )
      );

      -- Create quota settings
      INSERT INTO public.quotas (
        user_id,
        plan,
        limits,
        usage
      ) VALUES (
        NEW.id,
        'free',
        jsonb_build_object(
          'maxChats', 10,
          'maxTokensPerDay', 1000,
          'maxMemories', 50,
          'maxFileSize', 5242880
        ),
        jsonb_build_object(
          'currentTokens', initial_tokens
        )
      );

      success := true;
      EXIT;

    EXCEPTION 
      WHEN unique_violation THEN
        success := true;
        EXIT;
      WHEN OTHERS THEN
        RAISE WARNING 'Error creating user profile (attempt %): %', retries + 1, SQLERRM;
        retries := retries + 1;
        IF retries < max_retries THEN
          PERFORM pg_sleep(0.1 * retries);
        END IF;
    END;
  END LOOP;

  RETURN NEW;
END;
$$;

-- Function to check if user can get token reset
CREATE OR REPLACE FUNCTION can_reset_tokens(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_last_reset timestamptz;
  v_tokens integer;
BEGIN
  -- Get user's last reset time and current tokens
  SELECT last_token_reset, tokens_used
  INTO v_last_reset, v_tokens
  FROM public.users
  WHERE id = p_user_id;

  -- Can reset if:
  -- 1. Tokens are below 80
  -- 2. Last reset was more than 24 hours ago (or never reset)
  RETURN v_tokens < 80 AND 
         (v_last_reset IS NULL OR v_last_reset < now() - interval '24 hours');
END;
$$;

-- Function to get time until next reset
CREATE OR REPLACE FUNCTION get_time_until_reset(p_user_id uuid)
RETURNS interval
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_last_reset timestamptz;
BEGIN
  -- Get user's last reset time
  SELECT last_token_reset
  INTO v_last_reset
  FROM public.users
  WHERE id = p_user_id;

  -- If never reset, can reset immediately
  IF v_last_reset IS NULL THEN
    RETURN interval '0';
  END IF;

  -- Calculate time until next reset
  RETURN greatest(
    (v_last_reset + interval '24 hours') - now(),
    interval '0'
  );
END;
$$;

-- Initialize memory stores for existing users
INSERT INTO memory_stores (user_id, memory_count, last_processed)
SELECT id, 0, now()
FROM users u
WHERE NOT EXISTS (
  SELECT 1 FROM memory_stores ms WHERE ms.user_id = u.id
);

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION can_reset_tokens TO authenticated;
GRANT EXECUTE ON FUNCTION get_time_until_reset TO authenticated;
GRANT EXECUTE ON FUNCTION init_memory_store TO authenticated;