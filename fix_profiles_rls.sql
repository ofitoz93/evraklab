-- Add login_token to consultant_clients table if not exists
ALTER TABLE public.consultant_clients ADD COLUMN IF NOT EXISTS login_token TEXT;

-- 1. Drop the recursive policy we created earlier
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;

-- 2. Restore/Ensure original select policy exists
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;
CREATE POLICY "Users can view all profiles" ON public.profiles
    FOR SELECT TO authenticated
    USING (true);

-- 3. Create a SECURITY DEFINER function to bypass recursion
CREATE OR REPLACE FUNCTION public.can_manage_profile(target_user_id UUID, target_client_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  caller_role TEXT;
  caller_org_id UUID;
BEGIN
  -- Get caller profile info (bypassing RLS recursion via SECURITY DEFINER)
  SELECT role, organization_id INTO caller_role, caller_org_id
  FROM public.profiles
  WHERE id = auth.uid();

  -- 1. System admins/admins can manage any profile
  IF caller_role = 'admin' OR caller_role = 'system_admin' THEN
    RETURN TRUE;
  END IF;

  -- 2. Organization members can manage profiles in their same organization
  --    or client accounts served by their organization
  IF caller_org_id IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = target_user_id AND organization_id = caller_org_id
    ) THEN
      RETURN TRUE;
    END IF;

    IF target_client_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.consultant_clients
      WHERE id = target_client_id AND consultant_company_id = caller_org_id
    ) THEN
      RETURN TRUE;
    END IF;
  END IF;

  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Apply clean non-recursive policies for write operations
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can manage all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Manage profiles policy" ON public.profiles;

CREATE POLICY "Manage profiles policy" ON public.profiles
    FOR ALL TO authenticated
    USING (
        id = auth.uid() 
        OR public.can_manage_profile(id, client_id)
    );

-- 5. Helper function to clear client login token
CREATE OR REPLACE FUNCTION public.clear_client_login_token(p_email TEXT)
RETURNS VOID AS $$
BEGIN
  UPDATE public.consultant_clients
  SET login_token = NULL
  WHERE email = p_email;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. RPC function to securely update password and confirm email using temp token
CREATE OR REPLACE FUNCTION public.setup_client_password(
  client_email text,
  temp_token text,
  new_password text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER -- runs with bypass security definer privileges
AS $$
DECLARE
  v_client_id uuid;
  v_user_id uuid;
BEGIN
  -- A. Verify the token in consultant_clients
  SELECT id INTO v_client_id
  FROM public.consultant_clients
  WHERE login_token = temp_token;

  IF v_client_id IS NULL THEN
    RETURN false;
  END IF;

  -- B. Verify the profile belongs to the client and has 'client' role
  SELECT id INTO v_user_id
  FROM public.profiles
  WHERE email = client_email AND role = 'client' AND client_id = v_client_id;

  IF v_user_id IS NULL THEN
    RETURN false;
  END IF;

  -- C. Update the password and confirm email in auth.users
  UPDATE auth.users
  SET 
    encrypted_password = extensions.crypt(new_password, extensions.gen_salt('bf', 10)),
    email_confirmed_at = COALESCE(email_confirmed_at, now()),
    updated_at = now()
  WHERE id = v_user_id;

  -- D. Clear the login token so it cannot be used again
  UPDATE public.consultant_clients
  SET login_token = null
  WHERE id = v_client_id;

  RETURN true;
END;
$$;
