/*
  # Notifications System

  ## New Table
  
  **notifications**
  - Real-time notifications for users
  - Tracks bids, messages, project updates
  - Read/unread status
  - Action links for quick access

  ## Notification Types
  - new_bid: Contractor submitted a bid
  - bid_accepted: Owner accepted your bid
  - bid_rejected: Owner rejected your bid
  - new_message: New chat message received
  - project_update: Project status changed
  - payment_received: Payment completed

  ## Security
  - RLS enabled
  - Users can only view their own notifications
*/

CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN (
    'new_bid',
    'bid_accepted',
    'bid_rejected',
    'new_message',
    'project_update',
    'payment_received'
  )),
  title text NOT NULL,
  message text NOT NULL,
  link text,
  is_read boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  metadata jsonb DEFAULT '{}'::jsonb
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notif_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notif_created ON notifications(created_at DESC);

-- Enable RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Policies
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

-- Function to create notification when bid is submitted
CREATE OR REPLACE FUNCTION notify_new_bid()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO notifications (user_id, type, title, message, link, metadata)
  SELECT
    p.owner_id,
    'new_bid',
    'New Bid Received',
    'A contractor submitted a bid for ' || p.title,
    '/projects/' || p.id,
    jsonb_build_object('bid_id', NEW.id, 'project_id', NEW.project_id)
  FROM projects p
  WHERE p.id = NEW.project_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for new bids
DROP TRIGGER IF EXISTS trigger_notify_new_bid ON bids;
CREATE TRIGGER trigger_notify_new_bid
  AFTER INSERT ON bids
  FOR EACH ROW
  EXECUTE FUNCTION notify_new_bid();

-- Function to create notification when message is sent
CREATE OR REPLACE FUNCTION notify_new_message()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO notifications (user_id, type, title, message, link, metadata)
  SELECT
    CASE 
      WHEN c.owner_id = NEW.sender_id THEN c.contractor_id
      ELSE c.owner_id
    END,
    'new_message',
    'New Message',
    'You have a new message',
    '/chat/' || NEW.conversation_id,
    jsonb_build_object('message_id', NEW.id, 'conversation_id', NEW.conversation_id)
  FROM conversations c
  WHERE c.id = NEW.conversation_id;
  
  UPDATE conversations
  SET last_message_at = NEW.created_at
  WHERE id = NEW.conversation_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for new messages
DROP TRIGGER IF EXISTS trigger_notify_new_message ON messages;
CREATE TRIGGER trigger_notify_new_message
  AFTER INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION notify_new_message();
