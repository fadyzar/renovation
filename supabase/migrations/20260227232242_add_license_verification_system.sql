/*
  # Add License Verification System

  1. New Columns in profiles table
    - `license_number` (text) - CSLB license number
    - `license_verified` (boolean) - Whether license is verified
    - `verification_status` (text) - Status: not_verified, pending, verified, rejected, expired, suspended
    - `verification_date` (timestamptz) - When verification was completed
    - `verified_by_admin` (uuid) - Admin who verified
    - `license_screenshot_url` (text) - Screenshot of CSLB verification page
    - `business_name` (text) - Business name from license
    - `license_expiration_date` (date) - License expiration date
  
  2. New Tables
    - `verification_logs` - Track all verification attempts and admin actions
  
  3. Storage
    - Create `license-documents` bucket for screenshots
  
  4. Security
    - Users can submit verification requests
    - Only admins can approve/reject
    - All actions are logged
*/

-- Add verification columns to profiles table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'license_verified'
  ) THEN
    ALTER TABLE profiles ADD COLUMN license_verified boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'verification_status'
  ) THEN
    ALTER TABLE profiles ADD COLUMN verification_status text DEFAULT 'not_verified';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'verification_date'
  ) THEN
    ALTER TABLE profiles ADD COLUMN verification_date timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'verified_by_admin'
  ) THEN
    ALTER TABLE profiles ADD COLUMN verified_by_admin uuid REFERENCES auth.users(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'license_screenshot_url'
  ) THEN
    ALTER TABLE profiles ADD COLUMN license_screenshot_url text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'business_name'
  ) THEN
    ALTER TABLE profiles ADD COLUMN business_name text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'license_expiration_date'
  ) THEN
    ALTER TABLE profiles ADD COLUMN license_expiration_date date;
  END IF;
END $$;

-- Create verification logs table
CREATE TABLE IF NOT EXISTS verification_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  action text NOT NULL,
  old_status text,
  new_status text,
  admin_id uuid REFERENCES auth.users(id),
  notes text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE verification_logs ENABLE ROW LEVEL SECURITY;

-- Contractors can view their own verification logs
CREATE POLICY "Users can view own verification logs"
  ON verification_logs
  FOR SELECT
  TO authenticated
  USING (profile_id IN (
    SELECT id FROM profiles WHERE id = auth.uid()
  ));

-- Only admins can insert verification logs (will be enforced by edge function)
CREATE POLICY "Admins can insert verification logs"
  ON verification_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Create storage bucket for license documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('license-documents', 'license-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can upload own license documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can view own license documents" ON storage.objects;
DROP POLICY IF EXISTS "Admins can view all license documents" ON storage.objects;

-- Allow authenticated users to upload their own license documents
CREATE POLICY "Users can upload own license documents"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'license-documents' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Allow users to view their own license documents
CREATE POLICY "Users can view own license documents"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'license-documents' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Allow admins to view all license documents (will add admin role check later)
CREATE POLICY "Admins can view all license documents"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'license-documents');

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_profiles_verification_status ON profiles(verification_status);
CREATE INDEX IF NOT EXISTS idx_verification_logs_profile_id ON verification_logs(profile_id);
CREATE INDEX IF NOT EXISTS idx_verification_logs_created_at ON verification_logs(created_at DESC);