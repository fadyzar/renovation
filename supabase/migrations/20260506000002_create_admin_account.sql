/*
  # Create Admin Account

  Run this in the Supabase SQL Editor AFTER creating the auth user manually:

  Step 1 — Go to: Authentication > Users > Add User
    Email:    admin@mgbit.co.il
    Password: 123456
    ✅ Auto Confirm User

  Step 2 — Run this SQL (replace the UUID with the one created in Step 1):
*/

-- After creating the auth user, copy the UUID from the Users table and run:
-- (Replace '00000000-0000-0000-0000-000000000000' with the actual UUID)

DO $$
DECLARE
  v_admin_id uuid;
BEGIN
  -- Find the user by email
  SELECT id INTO v_admin_id
  FROM auth.users
  WHERE email = 'admin@mgbit.co.il'
  LIMIT 1;

  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'Admin user not found. Create it first via Authentication > Users > Add User';
  END IF;

  -- Insert or update the profile with admin role
  INSERT INTO profiles (id, role, full_name, email, created_at, updated_at)
  VALUES (
    v_admin_id,
    'admin',
    'M.G.BIT Admin',
    'admin@mgbit.co.il',
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE
    SET role      = 'admin',
        full_name = 'M.G.BIT Admin',
        email     = 'admin@mgbit.co.il',
        updated_at = NOW();

  RAISE NOTICE 'Admin profile created/updated for user: %', v_admin_id;
END;
$$;
