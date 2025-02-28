-- Fix is_admin function to work without parameters
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM admin_users
    WHERE user_id = auth.uid()
    AND role IN ('super_admin', 'admin')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fix is_2fa_enabled function to work without parameters
CREATE OR REPLACE FUNCTION is_2fa_enabled()
RETURNS boolean AS $$
DECLARE
  v_enabled boolean;
BEGIN
  SELECT enabled INTO v_enabled
  FROM user_2fa
  WHERE user_id = auth.uid();
  
  RETURN COALESCE(v_enabled, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fix increment_counter function
CREATE OR REPLACE FUNCTION increment_counter(row_id uuid)
RETURNS integer AS $$
DECLARE
  v_count integer;
BEGIN
  SELECT memory_count + 1 INTO v_count
  FROM memory_stores
  WHERE user_id = row_id;
  
  RETURN COALESCE(v_count, 1);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.is_admin TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_2fa_enabled TO authenticated;
GRANT EXECUTE ON FUNCTION public.increment_counter TO authenticated;