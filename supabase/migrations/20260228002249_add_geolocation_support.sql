/*
  # Add Geolocation Support

  ## Overview
  This migration adds comprehensive geolocation capabilities to the platform, enabling location-based project matching and distance calculations between contractors and projects.

  ## Changes Made

  ### 1. Projects Table Enhancements
    - `latitude` (double precision): Geographic latitude coordinate
    - `longitude` (double precision): Geographic longitude coordinate
    - `location_accuracy` (integer): GPS accuracy in meters
    - `formatted_address` (text): Human-readable address from geocoding
    - Indexes on latitude/longitude for efficient spatial queries

  ### 2. Profiles Table Enhancements
    - `service_latitude` (double precision): Contractor's service area center latitude
    - `service_longitude` (double precision): Contractor's service area center longitude
    - `service_radius_km` (integer): Maximum service radius in kilometers
    - `location_enabled` (boolean): Whether contractor has enabled location services
    - Default service radius: 50km

  ### 3. Performance Optimizations
    - Composite index on (latitude, longitude) for both tables
    - Index on service_radius_km for range queries

  ## Notes
  - Uses PostGIS-compatible coordinate system (WGS84)
  - Supports distance calculations up to 500km radius
  - Location data is optional and user-controlled
  - All location fields nullable for privacy
*/

-- Add geolocation fields to projects table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'projects' AND column_name = 'latitude'
  ) THEN
    ALTER TABLE projects ADD COLUMN latitude double precision;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'projects' AND column_name = 'longitude'
  ) THEN
    ALTER TABLE projects ADD COLUMN longitude double precision;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'projects' AND column_name = 'location_accuracy'
  ) THEN
    ALTER TABLE projects ADD COLUMN location_accuracy integer;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'projects' AND column_name = 'formatted_address'
  ) THEN
    ALTER TABLE projects ADD COLUMN formatted_address text;
  END IF;
END $$;

-- Add geolocation fields to profiles table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'service_latitude'
  ) THEN
    ALTER TABLE profiles ADD COLUMN service_latitude double precision;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'service_longitude'
  ) THEN
    ALTER TABLE profiles ADD COLUMN service_longitude double precision;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'service_radius_km'
  ) THEN
    ALTER TABLE profiles ADD COLUMN service_radius_km integer DEFAULT 50;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'location_enabled'
  ) THEN
    ALTER TABLE profiles ADD COLUMN location_enabled boolean DEFAULT false;
  END IF;
END $$;

-- Create indexes for efficient geospatial queries
CREATE INDEX IF NOT EXISTS idx_projects_location ON projects(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_profiles_service_location ON profiles(service_latitude, service_longitude);
CREATE INDEX IF NOT EXISTS idx_profiles_service_radius ON profiles(service_radius_km);

-- Create function to calculate distance between two points (Haversine formula)
CREATE OR REPLACE FUNCTION calculate_distance_km(
  lat1 double precision,
  lon1 double precision,
  lat2 double precision,
  lon2 double precision
)
RETURNS double precision AS $$
DECLARE
  r double precision := 6371; -- Earth's radius in kilometers
  dlat double precision;
  dlon double precision;
  a double precision;
  c double precision;
BEGIN
  IF lat1 IS NULL OR lon1 IS NULL OR lat2 IS NULL OR lon2 IS NULL THEN
    RETURN NULL;
  END IF;

  dlat := radians(lat2 - lat1);
  dlon := radians(lon2 - lon1);
  
  a := sin(dlat/2) * sin(dlat/2) + 
       cos(radians(lat1)) * cos(radians(lat2)) * 
       sin(dlon/2) * sin(dlon/2);
  
  c := 2 * atan2(sqrt(a), sqrt(1-a));
  
  RETURN r * c;
END;
$$ LANGUAGE plpgsql IMMUTABLE;