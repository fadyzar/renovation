/*
  # Add Additional Project Fields
  
  1. Changes
    - Add address column to projects table
    - Add city column to projects table
    - Add state column to projects table
    - Add zip_code column to projects table
    - Add country column to projects table
    - Add apartment_unit column to projects table
    - Add room_length column to projects table (numeric)
    - Add room_width column to projects table (numeric)
    - Add timeline column to projects table
  
  2. Purpose
    - Support comprehensive project creation with all location details
    - Enable room dimension tracking for accurate quotes
    - Track project timeline preferences
    - Store complete address information
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'projects' AND column_name = 'address'
  ) THEN
    ALTER TABLE projects ADD COLUMN address text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'projects' AND column_name = 'city'
  ) THEN
    ALTER TABLE projects ADD COLUMN city text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'projects' AND column_name = 'state'
  ) THEN
    ALTER TABLE projects ADD COLUMN state text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'projects' AND column_name = 'zip_code'
  ) THEN
    ALTER TABLE projects ADD COLUMN zip_code text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'projects' AND column_name = 'country'
  ) THEN
    ALTER TABLE projects ADD COLUMN country text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'projects' AND column_name = 'apartment_unit'
  ) THEN
    ALTER TABLE projects ADD COLUMN apartment_unit text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'projects' AND column_name = 'room_length'
  ) THEN
    ALTER TABLE projects ADD COLUMN room_length numeric;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'projects' AND column_name = 'room_width'
  ) THEN
    ALTER TABLE projects ADD COLUMN room_width numeric;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'projects' AND column_name = 'timeline'
  ) THEN
    ALTER TABLE projects ADD COLUMN timeline text DEFAULT 'flexible';
  END IF;
END $$;
