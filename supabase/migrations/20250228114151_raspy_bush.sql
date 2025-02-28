/*
  # Add Support Messages Table

  1. New Tables
    - `support_messages`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references users)
      - `message` (text)
      - `status` (text)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on support_messages table
    - Add policy for users to create their own messages
    - Add policy for admins to view all messages
*/

-- Create support messages table
CREATE TABLE IF NOT EXISTS support_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  message text NOT NULL,
  status text NOT NULL CHECK (status IN ('pending', 'in_progress', 'resolved', 'closed')),
  admin_notes text,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE support_messages ENABLE ROW LEVEL SECURITY;

-- Add RLS policies
CREATE POLICY "Users can create own support messages"
  ON support_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own support messages"
  ON support_messages
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all support messages"
  ON support_messages
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users au
      WHERE au.user_id = auth.uid()
      AND (au.role IN ('super_admin', 'admin', 'support'))
    )
  );

-- Create function to add support message
CREATE OR REPLACE FUNCTION add_support_message(
  p_message text,
  p_metadata jsonb DEFAULT '{}'
)
RETURNS support_messages AS $$
DECLARE
  v_message support_messages;
BEGIN
  -- Ensure authenticated
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Insert message
  INSERT INTO support_messages (
    user_id,
    message,
    status,
    metadata
  )
  VALUES (
    auth.uid(),
    p_message,
    'pending',
    p_metadata
  )
  RETURNING * INTO v_message;

  -- Log admin action
  INSERT INTO admin_audit_logs (
    action,
    target_table,
    target_id,
    metadata
  )
  VALUES (
    'support_message_created',
    'support_messages',
    v_message.id,
    jsonb_build_object(
      'message', p_message,
      'user_id', auth.uid()
    )
  );

  RETURN v_message;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION add_support_message TO authenticated;