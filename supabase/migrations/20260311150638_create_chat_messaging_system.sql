/*
  # Chat Messaging System

  ## New Tables
  
  1. **conversations**
     - Stores chat conversations between owners and contractors
     - Links to projects and bids
     - Tracks last message time for sorting
  
  2. **messages**
     - Individual chat messages
     - Read status tracking
     - Timestamps for ordering

  ## Security
  - RLS enabled on both tables
  - Users can only access their own conversations
  - Users can only send messages in conversations they belong to
*/

-- Conversations table
CREATE TABLE IF NOT EXISTS conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  bid_id uuid REFERENCES bids(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  contractor_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  last_message_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  CONSTRAINT unique_project_contractor UNIQUE(project_id, contractor_id)
);

-- Messages table
CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content text NOT NULL,
  is_read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_msg_conv ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_msg_time ON messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_conv_owner ON conversations(owner_id);
CREATE INDEX IF NOT EXISTS idx_conv_contractor ON conversations(contractor_id);
CREATE INDEX IF NOT EXISTS idx_conv_project ON conversations(project_id);

-- Enable RLS
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Conversations policies
CREATE POLICY "View own conversations"
  ON conversations FOR SELECT
  TO authenticated
  USING (auth.uid() = owner_id OR auth.uid() = contractor_id);

CREATE POLICY "Create conversations"
  ON conversations FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = contractor_id OR auth.uid() = owner_id);

CREATE POLICY "Update own conversations"
  ON conversations FOR UPDATE
  TO authenticated
  USING (auth.uid() = owner_id OR auth.uid() = contractor_id);

-- Messages policies
CREATE POLICY "View own messages"
  ON messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = messages.conversation_id
      AND (c.owner_id = auth.uid() OR c.contractor_id = auth.uid())
    )
  );

CREATE POLICY "Send messages"
  ON messages FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "Update messages"
  ON messages FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = messages.conversation_id
      AND (c.owner_id = auth.uid() OR c.contractor_id = auth.uid())
    )
  );
