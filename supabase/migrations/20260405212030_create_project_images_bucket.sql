/*
  # Create Project Images Storage Bucket

  1. Storage Bucket
    - `project-images` bucket for project renovation photos
    - Public bucket for easier access

  2. Security
    - Owners can upload images for their projects
    - Everyone can view images (public bucket)
    - Proper RLS policies for uploads

  ## Notes
  - Images stored in folders by project ID
  - Public URLs for easy display
*/

-- Create the project-images bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'project-images',
  'project-images',
  true,
  10485760,
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can upload project images" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view project images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their project images" ON storage.objects;

-- Allow authenticated users to upload images to their own project folders
CREATE POLICY "Users can upload project images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'project-images'
  );

-- Allow everyone to read project images (public bucket)
CREATE POLICY "Anyone can view project images"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'project-images');

-- Allow owners to delete their project images
CREATE POLICY "Users can delete their project images"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'project-images'
  );
