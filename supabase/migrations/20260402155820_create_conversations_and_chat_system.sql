/*
  # Complete Chat & Conversations System

  ## Overview
  Creates a complete chat system with:
  - Conversations between owners and contractors
  - Messages with attachments
  - Anti-bypass protection
  - Realtime support

  ## New Tables
  
  1. **conversations** - Chat conversations
  2. **chat_violations** - Anti-bypass violations logging
  3. **blocked_patterns** - Configurable patterns to block

  ## Updates to Existing Tables
  - **messages** - Add conversation_id, content, is_read, attachments
*/

-- Drop old messages table constraints if they exist
DO $$
BEGIN
  ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_project_id_fkey;
  ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_sender_id_fkey;
  ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_receiver_id_fkey;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

-- Conversations table
CREATE TABLE IF NOT EXISTS conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  contractor_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  last_message_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  CONSTRAINT unique_project_contractor UNIQUE(project_id, contractor_id)
);

-- Recreate messages table with proper structure
DROP TABLE IF EXISTS messages CASCADE;

CREATE TABLE messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content text,
  attachment_url text,
  attachment_type text,
  attachment_name text,
  is_read boolean DEFAULT false,
  flagged_for_violation boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT messages_content_or_attachment CHECK (content IS NOT NULL OR attachment_url IS NOT NULL)
);

-- Chat violations table
CREATE TABLE IF NOT EXISTS chat_violations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  message_id uuid REFERENCES messages(id) ON DELETE SET NULL,
  violator_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  violation_type text NOT NULL CHECK (violation_type IN ('phone_number', 'email', 'social_media', 'bypass_attempt', 'external_contact')),
  detected_pattern text NOT NULL,
  original_message text NOT NULL,
  severity text DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  action_taken text CHECK (action_taken IN ('warning', 'message_blocked', 'account_suspended', 'none')),
  resolved boolean DEFAULT false,
  resolved_at timestamptz,
  resolved_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now()
);

-- Blocked patterns table
CREATE TABLE IF NOT EXISTS blocked_patterns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pattern_type text NOT NULL CHECK (pattern_type IN ('regex', 'keyword', 'phrase')),
  pattern text NOT NULL,
  description text,
  severity text DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_conversations_project ON conversations(project_id);
CREATE INDEX IF NOT EXISTS idx_conversations_owner ON conversations(owner_id);
CREATE INDEX IF NOT EXISTS idx_conversations_contractor ON conversations(contractor_id);

CREATE INDEX IF NOT EXISTS idx_msg_conv ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_msg_time ON messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_msg_sender ON messages(sender_id);

CREATE INDEX IF NOT EXISTS idx_violations_conversation ON chat_violations(conversation_id);
CREATE INDEX IF NOT EXISTS idx_violations_violator ON chat_violations(violator_id);
CREATE INDEX IF NOT EXISTS idx_violations_type ON chat_violations(violation_type);
CREATE INDEX IF NOT EXISTS idx_violations_created ON chat_violations(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_blocked_patterns_active ON blocked_patterns(active);

-- Enable RLS
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_violations ENABLE ROW LEVEL SECURITY;
ALTER TABLE blocked_patterns ENABLE ROW LEVEL SECURITY;

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

-- Chat violations policies
CREATE POLICY "Admins can view all violations"
  ON chat_violations FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Users can view own violations"
  ON chat_violations FOR SELECT
  TO authenticated
  USING (violator_id = auth.uid());

CREATE POLICY "System can create violations"
  ON chat_violations FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Blocked patterns policies (all authenticated users can view for client-side validation)
CREATE POLICY "All users can view blocked patterns"
  ON blocked_patterns FOR SELECT
  TO authenticated
  USING (active = true);

-- Insert default blocked patterns
INSERT INTO blocked_patterns (pattern_type, pattern, description, severity) VALUES
  ('regex', '\b\d{3}[-.]?\d{3}[-.]?\d{4}\b', 'US Phone Number Pattern', 'high'),
  ('regex', '\b\d{10,}\b', 'Generic Long Number (Possible Phone)', 'medium'),
  ('regex', '\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b', 'Email Address', 'high'),
  ('keyword', 'whatsapp', 'WhatsApp mention', 'high'),
  ('keyword', 'telegram', 'Telegram mention', 'high'),
  ('keyword', 'call me', 'Direct call request', 'medium'),
  ('keyword', 'text me', 'Direct text request', 'medium'),
  ('keyword', 'phone', 'Phone mention', 'low'),
  ('phrase', 'let''s talk outside', 'Bypass attempt', 'critical'),
  ('phrase', 'contact me directly', 'Direct contact request', 'high'),
  ('phrase', 'my number is', 'Phone number sharing', 'critical'),
  ('phrase', 'email me at', 'Email sharing', 'critical'),
  ('phrase', 'reach me at', 'Contact sharing', 'high')
ON CONFLICT DO NOTHING;

-- Function to detect violations in message
CREATE OR REPLACE FUNCTION detect_message_violations(message_text text)
RETURNS TABLE (
  violation_type text,
  detected_pattern text,
  severity text
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    CASE 
      WHEN bp.pattern_type = 'regex' AND message_text ~* bp.pattern THEN
        CASE
          WHEN bp.pattern ~* 'phone|number|\d{10}' THEN 'phone_number'::text
          WHEN bp.pattern ~* 'email|@' THEN 'email'::text
          ELSE 'bypass_attempt'::text
        END
      WHEN bp.pattern_type = 'keyword' AND message_text ILIKE '%' || bp.pattern || '%' THEN
        CASE
          WHEN bp.pattern ILIKE '%whatsapp%' OR bp.pattern ILIKE '%telegram%' THEN 'social_media'::text
          ELSE 'bypass_attempt'::text
        END
      WHEN bp.pattern_type = 'phrase' AND message_text ILIKE '%' || bp.pattern || '%' THEN
        'external_contact'::text
      ELSE NULL
    END as violation_type,
    bp.pattern as detected_pattern,
    bp.severity as severity
  FROM blocked_patterns bp
  WHERE bp.active = true
    AND (
      (bp.pattern_type = 'regex' AND message_text ~* bp.pattern)
      OR (bp.pattern_type = 'keyword' AND message_text ILIKE '%' || bp.pattern || '%')
      OR (bp.pattern_type = 'phrase' AND message_text ILIKE '%' || bp.pattern || '%')
    )
  LIMIT 1;
END;
$$;
