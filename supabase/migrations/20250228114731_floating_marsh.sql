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

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can create own support messages" ON support_messages;
DROP POLICY IF EXISTS "Users can view own support messages" ON support_messages;
DROP POLICY IF EXISTS "Admins can view all support messages" ON support_messages;

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
  v_user_email text;
BEGIN
  -- Ensure authenticated
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Get user email for reference
  SELECT email INTO v_user_email
  FROM auth.users
  WHERE id = auth.uid();

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
    jsonb_build_object(
      'user_email', v_user_email,
      'source', COALESCE(p_metadata->>'source', 'web'),
      'timestamp', COALESCE(p_metadata->>'timestamp', now()::text)
    )
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
      'user_id', auth.uid(),
      'user_email', v_user_email
    )
  );

  RETURN v_message;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to get support messages for admins
CREATE OR REPLACE FUNCTION get_support_messages(
  p_status text DEFAULT NULL,
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  user_email text,
  message text,
  status text,
  admin_notes text,
  metadata jsonb,
  created_at timestamptz,
  updated_at timestamptz
) AS $$
BEGIN
  -- Check admin permission
  IF NOT EXISTS (
    SELECT 1 FROM admin_users au
    WHERE au.user_id = auth.uid()
    AND (au.role IN ('super_admin', 'admin', 'support'))
  ) THEN
    RAISE EXCEPTION 'Insufficient permissions';
  END IF;

  RETURN QUERY
  SELECT 
    sm.id,
    sm.user_id,
    u.email as user_email,
    sm.message,
    sm.status,
    sm.admin_notes,
    sm.metadata,
    sm.created_at,
    sm.updated_at
  FROM support_messages sm
  JOIN auth.users u ON u.id = sm.user_id
  WHERE 
    (p_status IS NULL OR sm.status = p_status)
  ORDER BY sm.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to update support message status
CREATE OR REPLACE FUNCTION update_support_message_status(
  p_message_id uuid,
  p_status text,
  p_admin_notes text DEFAULT NULL
)
RETURNS support_messages AS $$
DECLARE
  v_message support_messages;
BEGIN
  -- Check admin permission
  IF NOT EXISTS (
    SELECT 1 FROM admin_users au
    WHERE au.user_id = auth.uid()
    AND (au.role IN ('super_admin', 'admin', 'support'))
  ) THEN
    RAISE EXCEPTION 'Insufficient permissions';
  END IF;

  -- Update message
  UPDATE support_messages
  SET 
    status = p_status,
    admin_notes = COALESCE(p_admin_notes, admin_notes),
    updated_at = now()
  WHERE id = p_message_id
  RETURNING * INTO v_message;

  -- Log admin action
  INSERT INTO admin_audit_logs (
    admin_id,
    action,
    target_table,
    target_id,
    metadata
  )
  SELECT
    au.id,
    'update_support_message_status',
    'support_messages',
    v_message.id,
    jsonb_build_object(
      'new_status', p_status,
      'admin_notes', p_admin_notes
    )
  FROM admin_users au
  WHERE au.user_id = auth.uid();

  RETURN v_message;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create index for faster status filtering
CREATE INDEX IF NOT EXISTS idx_support_messages_status ON support_messages(status);
CREATE INDEX IF NOT EXISTS idx_support_messages_created_at ON support_messages(created_at DESC);

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION add_support_message TO authenticated;
GRANT EXECUTE ON FUNCTION get_support_messages TO authenticated;
GRANT EXECUTE ON FUNCTION update_support_message_status TO authenticated;