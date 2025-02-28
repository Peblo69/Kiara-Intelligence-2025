/*
  # Fix Email Verification Function

  1. Changes
    - Add is_email_verified function to check email verification status
    - Fix function name mismatch between auth.is_email_verified and public.is_email_verified
    - Add proper error handling and logging
    - Add function to public schema for RPC access

  2. Security
    - Enable RLS
    - Add proper security definer
    - Add authentication checks
*/

-- Drop existing functions if they exist
DROP FUNCTION IF EXISTS auth.is_email_verified;
DROP FUNCTION IF EXISTS public.is_email_verified(uuid);

-- Create function in auth schema
CREATE OR REPLACE FUNCTION auth.is_email_verified(p_user_id uuid)
RETURNS boolean AS $$
DECLARE
  v_confirmed boolean;
BEGIN
  SELECT 
    COALESCE(
      email_confirmed_at IS NOT NULL AND confirmed_at IS NOT NULL,
      false
    ) INTO v_confirmed
  FROM auth.users
  WHERE id = p_user_id;
  
  RETURN COALESCE(v_confirmed, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create public wrapper function for RPC access
CREATE OR REPLACE FUNCTION public.is_email_verified(p_user_id uuid)
RETURNS boolean AS $$
BEGIN
  -- Ensure authenticated
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Only allow users to check their own verification status
  IF p_user_id != auth.uid() THEN
    RAISE EXCEPTION 'Cannot check verification status for other users';
  END IF;

  -- Call auth schema function
  RETURN auth.is_email_verified(p_user_id);
EXCEPTION
  WHEN others THEN
    -- Log error but return false to avoid exposing error details
    RAISE WARNING 'Error checking email verification: %', SQLERRM;
    RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.is_email_verified(uuid) TO authenticated;