/*
  # Add Location Fields to Projects Table
  
  1. Changes
    - Add property_address column to projects table
    - Add property_city column to projects table
    - Add property_state column to projects table
    - Add property_zip column to projects table
    - Add room_dimensions column to projects table
    - Add finish_level column to projects table
  
  2. Purpose
    - Enable direct access to property location without joining properties table
    - Support project details display with location information
    - Add room specifications for renovation projects
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'projects' AND column_name = 'property_address'
  ) THEN
    ALTER TABLE projects ADD COLUMN property_address text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'projects' AND column_name = 'property_city'
  ) THEN
    ALTER TABLE projects ADD COLUMN property_city text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'projects' AND column_name = 'property_state'
  ) THEN
    ALTER TABLE projects ADD COLUMN property_state text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'projects' AND column_name = 'property_zip'
  ) THEN
    ALTER TABLE projects ADD COLUMN property_zip text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'projects' AND column_name = 'room_dimensions'
  ) THEN
    ALTER TABLE projects ADD COLUMN room_dimensions text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'projects' AND column_name = 'finish_level'
  ) THEN
    ALTER TABLE projects ADD COLUMN finish_level text DEFAULT 'Standard';
  END IF;
END $$;
