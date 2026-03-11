/*
  # Add Message Attachments Support

  ## Changes
  1. Add attachment fields to messages table
     - `attachment_url` - URL to the uploaded file in storage
     - `attachment_type` - Type of attachment (image, video, file, etc.)
     - `attachment_name` - Original filename
  
  2. Make content optional for messages with attachments
  
  ## Security
  - Existing RLS policies continue to apply
  - Storage bucket policies will control file access
*/

-- Add attachment columns to messages table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'messages' AND column_name = 'attachment_url'
  ) THEN
    ALTER TABLE messages ADD COLUMN attachment_url text;
    ALTER TABLE messages ADD COLUMN attachment_type text;
    ALTER TABLE messages ADD COLUMN attachment_name text;
  END IF;
END $$;

-- Allow content to be nullable for attachment-only messages
DO $$
BEGIN
  ALTER TABLE messages ALTER COLUMN content DROP NOT NULL;
END $$;

-- Add constraint to ensure either content or attachment exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'messages_content_or_attachment'
  ) THEN
    ALTER TABLE messages ADD CONSTRAINT messages_content_or_attachment
      CHECK (content IS NOT NULL OR attachment_url IS NOT NULL);
  END IF;
END $$;
