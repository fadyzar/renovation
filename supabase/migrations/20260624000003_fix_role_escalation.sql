/*
  # Close role-escalation holes

  Two paths let a client set role='admin':
  1. handle_new_user() cast `raw_user_meta_data->>'role'` (client-controlled at
     signUp) straight to user_role — so signUp({data:{role:'admin'}}) created an
     admin. Now clamp to self-service roles only.
  2. The "Users can update own profile" RLS policy lets a user UPDATE any column
     of their own row, including `role` → self-promote to admin. Add a BEFORE
     UPDATE trigger that forbids an authenticated user from changing role to/from
     'admin' (service-role / server-side migrations are unaffected).

  Existing admins are unaffected: this only governs new signups and client-side
  updates; admin rows are created server-side.
*/

-- 1. Clamp signup role ---------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
BEGIN
  v_role := COALESCE(NEW.raw_user_meta_data->>'role', 'property_owner');
  -- Never trust client metadata for privileged roles.
  IF v_role NOT IN ('property_owner', 'contractor') THEN
    v_role := 'property_owner';
  END IF;

  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'User'),
    v_role::user_role
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Error creating profile for user %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

-- 2. Block client-side admin role changes -------------------------------------
CREATE OR REPLACE FUNCTION public.prevent_role_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role
     AND (NEW.role = 'admin' OR OLD.role = 'admin')
     AND auth.role() = 'authenticated' THEN
    RAISE EXCEPTION 'Changing the admin role is not permitted';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_prevent_role_escalation ON profiles;
CREATE TRIGGER trigger_prevent_role_escalation
  BEFORE UPDATE OF role ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_role_escalation();
