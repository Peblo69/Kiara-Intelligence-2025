-- Drop any conflicting triggers first
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS handle_email_confirmation ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_email_confirmed ON auth.users;
DROP TRIGGER IF EXISTS ensure_user_profile ON auth.users;
DROP TRIGGER IF EXISTS update_auth_users_updated_at ON auth.users;

-- Create function to create user profile with proper error handling
CREATE OR REPLACE FUNCTION public.create_profile_for_user() 
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (
    id, 
    email,
    display_name,
    tokens_used,
    active_subscription,
    created_at,
    updated_at
  ) VALUES (
    NEW.id,
    NEW.email,
    split_part(NEW.email, '@', 1),
    0,
    'free',
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
EXCEPTION
  WHEN others THEN
    -- Log error but don't block auth user creation
    RAISE WARNING 'Error creating user profile: %', SQLERRM;
    RETURN NEW;
END;
$$;

-- Create trigger to add profile after user creation
DROP TRIGGER IF EXISTS create_profile_for_user ON auth.users;
CREATE TRIGGER create_profile_for_user
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.create_profile_for_user();

-- Create function to handle email confirmation
CREATE OR REPLACE FUNCTION auth.handle_email_confirmation() 
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Set email_confirmed metadata for new users
    NEW.raw_app_meta_data = COALESCE(NEW.raw_app_meta_data, '{}'::jsonb) || 
      jsonb_build_object('email_confirmed', false);
  ELSIF TG_OP = 'UPDATE' THEN
    -- Handle email confirmation updates
    IF NEW.email_confirmed_at IS NOT NULL AND 
       (OLD.email_confirmed_at IS NULL OR OLD.email_confirmed_at <> NEW.email_confirmed_at) 
    THEN
      NEW.raw_app_meta_data = COALESCE(NEW.raw_app_meta_data, '{}'::jsonb) || 
        jsonb_build_object('email_confirmed', true);
      
      -- Also update confirmed_at for compatibility
      NEW.confirmed_at = NEW.email_confirmed_at;
    END IF;
  END IF;
  
  RETURN NEW;
EXCEPTION
  WHEN others THEN
    -- Log error but don't block the operation
    RAISE WARNING 'Error in handle_email_confirmation: %', SQLERRM;
    RETURN NEW;
END;
$$;

-- Create trigger for email confirmation
DROP TRIGGER IF EXISTS handle_email_confirmation ON auth.users;
CREATE TRIGGER handle_email_confirmation
BEFORE INSERT OR UPDATE ON auth.users
FOR EACH ROW EXECUTE FUNCTION auth.handle_email_confirmation();

-- Function to keep updated_at current
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Check if the trigger already exists and only create if it doesn't
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'update_users_updated_at'
      AND tgrelid = 'public.users'::regclass
  ) THEN
    -- Create the updated_at trigger for users
    CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON public.users
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END
$$;

-- Function to safely get user profile
CREATE OR REPLACE FUNCTION public.get_or_create_user_profile(user_id uuid)
RETURNS SETOF users AS $$
BEGIN
  -- Try to insert if not exists
  INSERT INTO public.users (
    id,
    email,
    display_name,
    tokens_used,
    active_subscription,
    created_at,
    updated_at
  )
  SELECT
    auth.id,
    auth.email,
    split_part(auth.email, '@', 1),
    0,
    'free',
    NOW(),
    NOW()
  FROM auth.users auth
  WHERE auth.id = user_id
  ON CONFLICT (id) DO NOTHING;
  
  -- Return the user record
  RETURN QUERY SELECT * FROM public.users WHERE id = user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO anon;
GRANT EXECUTE ON FUNCTION public.get_or_create_user_profile TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_or_create_user_profile TO anon;