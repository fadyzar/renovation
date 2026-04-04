/*
  # Add Missing Profile Columns
  
  1. Adds missing columns to profiles table:
    - specialties (text array) - contractor specialties
    - years_experience (integer) - years of professional experience
    - license_verified (boolean) - license verification status
  
  2. Updates RLS policies remain unchanged
*/

-- Add missing columns to profiles table
DO $$ 
BEGIN
  -- Add specialties column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'specialties'
  ) THEN
    ALTER TABLE profiles ADD COLUMN specialties text[] DEFAULT ARRAY[]::text[];
  END IF;

  -- Add years_experience column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'years_experience'
  ) THEN
    ALTER TABLE profiles ADD COLUMN years_experience integer DEFAULT 0;
  END IF;

  -- Add license_verified column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'license_verified'
  ) THEN
    ALTER TABLE profiles ADD COLUMN license_verified boolean DEFAULT false;
  END IF;
END $$;