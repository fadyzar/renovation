/*
  # Improve Notification System

  1. Extend CHECK constraint to include all notification types used by the app
  2. Improve notify_new_bid trigger — includes contractor name + amount
  3. Improve notify_new_message trigger — includes sender name, throttled (10 min)
  4. Add trigger on `milestones` for awaiting_approval → notify owner
  5. Add trigger on `milestones` for paid → notify contractor
*/

-- ─── 1. Extend CHECK constraint ───────────────────────────────────────────────

ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check CHECK (type IN (
  'new_bid',
  'bid_accepted',
  'bid_rejected',
  'new_message',
  'project_update',
  'payment_received',
  'milestone_submitted',
  'project_activated',
  'deposit_paid'
));

-- ─── 2. Improve notify_new_bid ────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION notify_new_bid()
RETURNS TRIGGER AS $$
DECLARE
  v_contractor_name text;
BEGIN
  SELECT full_name INTO v_contractor_name FROM profiles WHERE id = NEW.contractor_id;

  INSERT INTO notifications (user_id, type, title, message, link, metadata)
  SELECT
    p.owner_id,
    'new_bid',
    'New Bid Received',
    COALESCE(v_contractor_name, 'A contractor')
      || ' submitted a bid of $'
      || TO_CHAR(NEW.total_price, 'FM999,999,999')
      || ' for "' || p.title || '"',
    '/contractor-matching/' || p.id,
    jsonb_build_object(
      'bid_id',         NEW.id,
      'project_id',     NEW.project_id,
      'amount',         NEW.total_price,
      'contractor_id',  NEW.contractor_id
    )
  FROM projects p
  WHERE p.id = NEW.project_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_notify_new_bid ON bids;
CREATE TRIGGER trigger_notify_new_bid
  AFTER INSERT ON bids
  FOR EACH ROW
  EXECUTE FUNCTION notify_new_bid();

-- ─── 3. Improve notify_new_message — sender name + 10-min throttle ────────────

CREATE OR REPLACE FUNCTION notify_new_message()
RETURNS TRIGGER AS $$
DECLARE
  v_recipient_id  uuid;
  v_sender_name   text;
  v_recent        timestamptz;
  v_preview       text;
BEGIN
  SELECT
    CASE WHEN c.owner_id = NEW.sender_id THEN c.contractor_id ELSE c.owner_id END
  INTO v_recipient_id
  FROM conversations c WHERE c.id = NEW.conversation_id;

  SELECT full_name INTO v_sender_name FROM profiles WHERE id = NEW.sender_id;

  -- Throttle: skip if we already notified this user for this conversation recently
  SELECT created_at INTO v_recent
  FROM notifications
  WHERE user_id       = v_recipient_id
    AND type          = 'new_message'
    AND (metadata->>'conversation_id')::text = NEW.conversation_id::text
    AND created_at    > NOW() - INTERVAL '10 minutes'
  LIMIT 1;

  IF v_recent IS NULL THEN
    v_preview := COALESCE(LEFT(NEW.content, 80), '📎 Attachment');
    IF LENGTH(NEW.content) > 80 THEN
      v_preview := v_preview || '…';
    END IF;

    INSERT INTO notifications (user_id, type, title, message, link, metadata)
    VALUES (
      v_recipient_id,
      'new_message',
      'New Message from ' || COALESCE(v_sender_name, 'Someone'),
      v_preview,
      '/messages',
      jsonb_build_object(
        'message_id',       NEW.id,
        'conversation_id',  NEW.conversation_id
      )
    );
  END IF;

  UPDATE conversations SET last_message_at = NEW.created_at WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_notify_new_message ON messages;
CREATE TRIGGER trigger_notify_new_message
  AFTER INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION notify_new_message();

-- ─── 4. Notify owner when contractor submits milestone ────────────────────────

CREATE OR REPLACE FUNCTION notify_milestone_submitted()
RETURNS TRIGGER AS $$
DECLARE
  v_owner_id      uuid;
  v_project_title text;
BEGIN
  IF NEW.status = 'awaiting_approval' AND OLD.status IS DISTINCT FROM 'awaiting_approval' THEN
    SELECT p.owner_id, p.title INTO v_owner_id, v_project_title
    FROM projects p WHERE p.id = NEW.project_id;

    IF v_owner_id IS NOT NULL THEN
      INSERT INTO notifications (user_id, type, title, message, link, metadata)
      VALUES (
        v_owner_id,
        'milestone_submitted',
        'Milestone Ready for Approval',
        '"' || NEW.title || '" submitted — $' || TO_CHAR(NEW.amount, 'FM999,999,999') || ' awaiting your approval',
        '/project/' || NEW.project_id || '/payments',
        jsonb_build_object(
          'project_id',   NEW.project_id,
          'milestone_id', NEW.id,
          'amount',       NEW.amount
        )
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_notify_milestone_submitted ON milestones;
CREATE TRIGGER trigger_notify_milestone_submitted
  AFTER UPDATE OF status ON milestones
  FOR EACH ROW
  EXECUTE FUNCTION notify_milestone_submitted();

-- ─── 5. Notify contractor when owner approves & pays milestone ────────────────

CREATE OR REPLACE FUNCTION notify_milestone_approved()
RETURNS TRIGGER AS $$
DECLARE
  v_contractor_id uuid;
  v_project_title text;
BEGIN
  IF NEW.status = 'paid' AND OLD.status IS DISTINCT FROM 'paid' THEN
    SELECT p.selected_contractor_id, p.title INTO v_contractor_id, v_project_title
    FROM projects p WHERE p.id = NEW.project_id;

    IF v_contractor_id IS NOT NULL THEN
      INSERT INTO notifications (user_id, type, title, message, link, metadata)
      VALUES (
        v_contractor_id,
        'payment_received',
        'Payment Released!',
        '"' || NEW.title || '" approved — $' || TO_CHAR(NEW.amount, 'FM999,999,999') || ' released to you',
        '/project/' || NEW.project_id || '/payments',
        jsonb_build_object(
          'project_id',   NEW.project_id,
          'milestone_id', NEW.id,
          'amount',       NEW.amount
        )
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_notify_milestone_approved ON milestones;
CREATE TRIGGER trigger_notify_milestone_approved
  AFTER UPDATE OF status ON milestones
  FOR EACH ROW
  EXECUTE FUNCTION notify_milestone_approved();
