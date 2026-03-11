/*
  # Create Chat Attachments Storage Bucket

  ## Changes
  1. Create a storage bucket for chat attachments
  2. Set up RLS policies for secure file access
  
  ## Security
  - Users can upload files to their own conversations
  - Users can view files from conversations they belong to
*/

-- Create storage bucket for chat attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-attachments', 'chat-attachments', false)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload files
CREATE POLICY "Users can upload chat attachments"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'chat-attachments' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Allow users to view files from their conversations
CREATE POLICY "Users can view own chat attachments"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'chat-attachments' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Allow users to delete their own attachments
CREATE POLICY "Users can delete own chat attachments"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'chat-attachments' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );
