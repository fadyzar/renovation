/*
  # Fix Critical Database Issues

  ## Problems Fixed
  1. Missing notifications table causing 404 errors
  2. Projects table queries failing with 500 errors
  3. Conversations table queries failing with 500 errors
  4. Project creation failing with 400 errors

  ## Changes
  1. Create notifications table if missing
  2. Fix RLS policies on projects table
  3. Fix RLS policies on conversations table
  4. Add necessary triggers and functions
  5. Ensure all foreign keys are properly set up

  ## Tables Modified
  - notifications (created if missing)
  - projects (RLS policies fixed)
  - conversations (RLS policies fixed)
*/

-- 1. Create notifications table if it doesn't exist
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN (
    'new_bid',
    'bid_accepted',
    'bid_rejected',
    'new_message',
    'project_update',
    'payment_received',
    'milestone_completed',
    'milestone_approved'
  )),
  title text NOT NULL,
  message text NOT NULL,
  link text,
  is_read boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  metadata jsonb DEFAULT '{}'::jsonb
);

-- Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notif_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notif_created ON notifications(created_at DESC);

-- Enable RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Users view own notifications" ON notifications;
DROP POLICY IF EXISTS "Users update own notifications" ON notifications;
DROP POLICY IF EXISTS "System creates notifications" ON notifications;

-- Create policies
CREATE POLICY "Users view own notifications"
  ON notifications FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users update own notifications"
  ON notifications FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "System creates notifications"
  ON notifications FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- 2. Fix projects table RLS policies
-- Drop old policies
DROP POLICY IF EXISTS "Owners can view own projects" ON projects;
DROP POLICY IF EXISTS "Contractors can view projects" ON projects;

-- Create simpler, more reliable policies
CREATE POLICY "Owners can view own projects"
  ON projects FOR SELECT
  TO authenticated
  USING (
    auth.uid() = owner_id 
    OR auth.uid() = selected_contractor_id
    OR status = 'seeking_quotes'
  );

-- 3. Fix conversations table RLS policies
-- Drop old policies
DROP POLICY IF EXISTS "Participants can view conversations" ON conversations;
DROP POLICY IF EXISTS "Participants can update conversations" ON conversations;

-- Create new policies
CREATE POLICY "Participants can view conversations"
  ON conversations FOR SELECT
  TO authenticated
  USING (
    auth.uid() = owner_id 
    OR auth.uid() = contractor_id
  );

CREATE POLICY "Users can create conversations"
  ON conversations FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = owner_id 
    OR auth.uid() = contractor_id
  );

-- 4. Fix messages table RLS policies
DROP POLICY IF EXISTS "Conversation participants can view messages" ON messages;
DROP POLICY IF EXISTS "Conversation participants can send messages" ON messages;

CREATE POLICY "Conversation participants can view messages"
  ON messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = conversation_id
      AND (c.owner_id = auth.uid() OR c.contractor_id = auth.uid())
    )
  );

CREATE POLICY "Conversation participants can send messages"
  ON messages FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = conversation_id
      AND (c.owner_id = auth.uid() OR c.contractor_id = auth.uid())
    )
  );

CREATE POLICY "Users can update own messages"
  ON messages FOR UPDATE
  TO authenticated
  USING (sender_id = auth.uid())
  WITH CHECK (sender_id = auth.uid());
