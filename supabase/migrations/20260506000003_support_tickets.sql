/*
  # Support Tickets System

  Tables:
  - support_tickets: user-submitted support requests
  - support_replies: admin + user replies on a ticket
*/

CREATE TABLE IF NOT EXISTS support_tickets (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  subject     text NOT NULL,
  message     text NOT NULL,
  status      text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'closed')),
  priority    text NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  category    text DEFAULT 'general' CHECK (category IN ('general', 'payment', 'contractor', 'project', 'technical', 'other')),
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS support_replies (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id   uuid NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  sender_id   uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  message     text NOT NULL,
  is_admin    boolean DEFAULT false,
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tickets_user     ON support_tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_tickets_status   ON support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_created  ON support_tickets(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_replies_ticket   ON support_replies(ticket_id);

ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_replies ENABLE ROW LEVEL SECURITY;

-- Users see only their own tickets
CREATE POLICY "Users view own tickets"   ON support_tickets FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users create tickets"     ON support_tickets FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins view all tickets"  ON support_tickets FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Replies
CREATE POLICY "Participants view replies" ON support_replies FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM support_tickets WHERE id = ticket_id AND user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
CREATE POLICY "Participants insert replies" ON support_replies FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = sender_id AND (
      EXISTS (SELECT 1 FROM support_tickets WHERE id = ticket_id AND user_id = auth.uid())
      OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    )
  );

-- Notify admins on new ticket
CREATE OR REPLACE FUNCTION notify_admins_new_ticket()
RETURNS TRIGGER AS $$
DECLARE
  v_user_name text;
  v_admin     RECORD;
BEGIN
  SELECT full_name INTO v_user_name FROM profiles WHERE id = NEW.user_id;
  FOR v_admin IN SELECT id FROM profiles WHERE role = 'admin' LOOP
    INSERT INTO notifications (user_id, type, title, message, link, metadata)
    VALUES (
      v_admin.id, 'project_update',
      '🎫 New Support Ticket',
      COALESCE(v_user_name, 'A user') || ': "' || LEFT(NEW.subject, 60) || '"',
      '/admin/support',
      jsonb_build_object('ticket_id', NEW.id)
    );
  END LOOP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_notify_admins_new_ticket ON support_tickets;
CREATE TRIGGER trigger_notify_admins_new_ticket
  AFTER INSERT ON support_tickets FOR EACH ROW
  EXECUTE FUNCTION notify_admins_new_ticket();
