/*
  # Fix Signup Trigger - Enum Casting Issue

  ## Problem
  The handle_new_user() function fails during signup because it doesn't properly cast
  the role string to the user_role enum type.

  ## Solution
  Update the function to properly cast the role value to user_role enum.

  ## Changes
  1. Recreate handle_new_user function with proper enum casting
*/

-- Drop and recreate the function with proper enum casting
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'User'),
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'property_owner'::user_role)
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Log the error but don't prevent user creation
  RAISE WARNING 'Error creating profile for user %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;
