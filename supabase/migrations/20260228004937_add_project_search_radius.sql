/*
  # Add Project Search Radius

  1. Changes
    - Add `search_radius_km` column to `projects` table
      - Stores the maximum distance the property owner wants to search for contractors
      - Default value of 50km
      - Used to match contractors within the specified distance

  2. Notes
    - This improves the matching experience between property owners and contractors
    - Property owners can define how far they're willing to find contractors
    - Works in conjunction with contractor service_radius_km for better matching
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'projects' AND column_name = 'search_radius_km'
  ) THEN
    ALTER TABLE projects ADD COLUMN search_radius_km integer DEFAULT 50;
  END IF;
END $$;