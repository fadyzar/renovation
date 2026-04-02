/*
  # Add Missing Project Fields

  ## Problem
  CreateProjectPage component uses fields that don't exist in the projects table,
  causing 400 errors when creating projects.

  ## Solution
  Add all missing fields to the projects table:
  - address, city, state, zip_code, country (location fields)
  - apartment_unit (for multi-unit properties)
  - room_length, room_width (room dimensions)
  - finish_level, timeline (project preferences)

  ## Changes
  1. Add location fields (address, city, state, zip_code, country, apartment_unit)
  2. Add dimension fields (room_length, room_width)
  3. Add project preference fields (finish_level, timeline)
*/

-- Add location fields
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
    ALTER TABLE projects ADD COLUMN country text DEFAULT 'USA';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'projects' AND column_name = 'apartment_unit'
  ) THEN
    ALTER TABLE projects ADD COLUMN apartment_unit text;
  END IF;
END $$;

-- Add dimension fields
DO $$
BEGIN
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
END $$;

-- Add project preference fields
DO $$
BEGIN
  -- Check if finish_level already exists from previous migration
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'projects' AND column_name = 'finish_level'
  ) THEN
    ALTER TABLE projects ADD COLUMN finish_level text DEFAULT 'standard';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'projects' AND column_name = 'timeline'
  ) THEN
    ALTER TABLE projects ADD COLUMN timeline text DEFAULT 'flexible';
  END IF;
END $$;
