-- Function to handle automatic tokens after email confirmation
CREATE OR REPLACE FUNCTION auth.handle_email_confirmation_tokens() 
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER
AS $$
DECLARE
  v_tokens_added boolean;
BEGIN
  -- Check if this is a newly confirmed email
  IF NEW.email_confirmed_at IS NOT NULL AND 
     (OLD.email_confirmed_at IS NULL OR OLD.email_confirmed_at <> NEW.email_confirmed_at) THEN
    
    -- Check if user already got their welcome tokens
    SELECT EXISTS (
      SELECT 1 FROM token_transactions 
      WHERE user_id = NEW.id 
      AND reason = 'bonus'
      AND metadata->>'source' = 'email_confirmation'
    ) INTO v_tokens_added;
    
    -- If user hasn't received welcome tokens yet, add them
    IF NOT v_tokens_added THEN
      -- Add 100 tokens to the user
      PERFORM public.add_user_tokens(
        NEW.id,
        100,
        'bonus',
        jsonb_build_object(
          'source', 'email_confirmation',
          'timestamp', now(),
          'description', 'Welcome bonus after email confirmation'
        )
      );
      
      -- Log action
      INSERT INTO admin_audit_logs (
        action,
        target_table,
        target_id,
        old_data,
        new_data,
        metadata
      ) VALUES (
        'add_welcome_tokens',
        'users',
        NEW.id,
        NULL,
        jsonb_build_object('tokens_added', 100),
        jsonb_build_object(
          'source', 'email_confirmation',
          'timestamp', now()
        )
      );
    END IF;
  END IF;
  
  RETURN NEW;
EXCEPTION
  WHEN others THEN
    -- Log error but don't block the operation
    RAISE WARNING 'Error in handle_email_confirmation_tokens: %', SQLERRM;
    RETURN NEW;
END;
$$;

-- Create trigger for email confirmation tokens
DROP TRIGGER IF EXISTS handle_email_confirmation_tokens ON auth.users;
CREATE TRIGGER handle_email_confirmation_tokens
AFTER UPDATE ON auth.users
FOR EACH ROW
WHEN (NEW.email_confirmed_at IS NOT NULL AND 
     (OLD.email_confirmed_at IS NULL OR OLD.email_confirmed_at <> NEW.email_confirmed_at))
EXECUTE FUNCTION auth.handle_email_confirmation_tokens();

-- Create a public function to check if email verification is required
CREATE OR REPLACE FUNCTION public.email_verification_required()
RETURNS boolean AS $$
BEGIN
  RETURN true;
END;
$$ LANGUAGE plpgsql IMMUTABLE SECURITY DEFINER;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION public.email_verification_required TO authenticated;
GRANT EXECUTE ON FUNCTION public.email_verification_required TO anon;

-- Add function to check email verification status
CREATE OR REPLACE FUNCTION public.is_email_verified(p_user_id uuid)
RETURNS boolean AS $$
DECLARE
  v_verified boolean;
BEGIN
  SELECT 
    email_confirmed_at IS NOT NULL AND 
    confirmed_at IS NOT NULL
  INTO v_verified
  FROM auth.users
  WHERE id = p_user_id;
  
  RETURN COALESCE(v_verified, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION public.is_email_verified TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_email_verified TO anon;