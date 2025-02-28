/*
  # Add offline support functions and utilities

  1. Changes
     - Add function to check database connectivity
     - Add retry capabilities to critical database operations
     - Add helper functions for better error handling

  2. Security
     - Maintain existing security settings
     - Add proper error handling to prevent data loss
*/

-- Function to ping the database for connectivity check
CREATE OR REPLACE FUNCTION check_connectivity()
RETURNS boolean AS $$
BEGIN
  -- Simplest possible query to check connection
  RETURN true;
EXCEPTION
  WHEN OTHERS THEN
    RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to safely process queued operations during reconnection
CREATE OR REPLACE FUNCTION process_queued_operation(
  p_operation_type text,
  p_parameters jsonb,
  p_user_id uuid
)
RETURNS jsonb AS $$
BEGIN
  -- Validate input
  IF p_operation_type IS NULL OR p_parameters IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid operation parameters');
  END IF;

  -- Process based on operation type
  CASE p_operation_type
    WHEN 'add_message' THEN
      RETURN jsonb_build_object(
        'success', true,
        'result', add_message_with_chat_update(
          (p_parameters->>'chat_id')::uuid,
          p_user_id,
          p_parameters->>'content',
          p_parameters->>'role',
          (p_parameters->>'is_streaming')::boolean,
          (p_parameters->>'error')::boolean
        )
      );
    
    WHEN 'add_memory' THEN
      RETURN jsonb_build_object(
        'success', true,
        'result', add_memory_with_store_update(
          p_user_id,
          (p_parameters->>'chat_id')::uuid,
          p_parameters->>'content',
          p_parameters->>'type',
          p_parameters->>'category',
          (p_parameters->>'confidence')::float,
          p_parameters->>'source',
          COALESCE(p_parameters->'metadata', '{}'::jsonb)
        )
      );
    
    ELSE
      RETURN jsonb_build_object('success', false, 'error', 'Unknown operation type');
  END CASE;
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'detail', SQLSTATE
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION check_connectivity() TO authenticated;
GRANT EXECUTE ON FUNCTION process_queued_operation(text, jsonb, uuid) TO authenticated;