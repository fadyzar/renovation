/*
  # WhatsApp notification layer — missing event flows, logs, idempotency

  Extends the existing unified notifications → dispatch-notification system so
  WhatsApp becomes a full per-event layer beside email. Delivery/formatting live
  in the edge function (_shared/whatsapp.ts); this migration only creates the
  notification rows for the events that weren't producing any:

    Req 2  quote submitted   → confirmation to the CONTRACTOR   (bid_submitted)
    Req 4  quote rejected    → professional message to CONTRACTOR (bid_rejected)
    Req 5  project created   → confirmation to the OWNER (project_update/project_created)
    Req 6  quote accepted    → confirmation to the OWNER (project_update/quote_accepted_owner)

  Also: whatsapp_logs gets recipient_type / event_type / quote_id, and the
  notifications type CHECK gains 'bid_submitted'. Every new insert is guarded
  (IF NOT EXISTS) so re-runs / retries never double-send. Idempotent.
*/

-- ─── 1. whatsapp_logs: richer columns ────────────────────────────────────────
ALTER TABLE whatsapp_logs ADD COLUMN IF NOT EXISTS recipient_type text;
ALTER TABLE whatsapp_logs ADD COLUMN IF NOT EXISTS event_type     text;
ALTER TABLE whatsapp_logs ADD COLUMN IF NOT EXISTS quote_id       uuid;

-- ─── 2. notifications type CHECK: add 'bid_submitted' ────────────────────────
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check CHECK (type IN (
  'welcome',
  'new_bid',
  'bid_submitted',
  'bid_accepted',
  'bid_rejected',
  'new_message',
  'project_update',
  'project_activated',
  'payment_received',
  'milestone_submitted',
  'milestone_completed',
  'milestone_approved',
  'deposit_paid'
));

-- ─── 3. Req 2: new bid → owner + admins (existing) + CONTRACTOR confirmation ──
CREATE OR REPLACE FUNCTION notify_new_bid()
RETURNS TRIGGER AS $$
DECLARE
  v_contractor_name text;
  v_project_title   text;
  v_owner_id        uuid;
  v_admin           RECORD;
BEGIN
  SELECT full_name INTO v_contractor_name FROM profiles WHERE id = NEW.contractor_id;
  SELECT title, owner_id INTO v_project_title, v_owner_id FROM projects WHERE id = NEW.project_id;

  -- Notify project owner (unchanged)
  INSERT INTO notifications (user_id, type, title, message, link, metadata)
  VALUES (
    v_owner_id,
    'new_bid',
    'New Bid Received',
    COALESCE(v_contractor_name, 'A contractor')
      || ' submitted a bid of $'
      || TO_CHAR(NEW.total_price, 'FM999,999,999')
      || ' for "' || v_project_title || '"',
    '/contractor-matching/' || NEW.project_id,
    jsonb_build_object(
      'bid_id',         NEW.id,
      'project_id',     NEW.project_id,
      'amount',         NEW.total_price,
      'contractor_id',  NEW.contractor_id
    )
  );

  -- Notify all admins (unchanged)
  FOR v_admin IN
    SELECT id FROM profiles WHERE role = 'admin'
  LOOP
    INSERT INTO notifications (user_id, type, title, message, link, metadata)
    VALUES (
      v_admin.id,
      'new_bid',
      '📋 New Bid — ' || COALESCE(v_project_title, 'Project'),
      COALESCE(v_contractor_name, 'Contractor')
        || ' bid $'
        || TO_CHAR(NEW.total_price, 'FM999,999,999'),
      '/admin',
      jsonb_build_object(
        'bid_id',        NEW.id,
        'project_id',    NEW.project_id,
        'amount',        NEW.total_price,
        'contractor_id', NEW.contractor_id
      )
    );
  END LOOP;

  -- NEW: confirmation to the CONTRACTOR who submitted the quote (once per bid).
  IF NOT EXISTS (
    SELECT 1 FROM notifications
    WHERE user_id = NEW.contractor_id
      AND type = 'bid_submitted'
      AND metadata->>'bid_id' = NEW.id::text
  ) THEN
    INSERT INTO notifications (user_id, type, title, message, link, metadata)
    VALUES (
      NEW.contractor_id,
      'bid_submitted',
      'Quote submitted',
      'Your quote of $' || TO_CHAR(NEW.total_price, 'FM999,999,999')
        || ' for "' || COALESCE(v_project_title, 'the project')
        || '" was submitted. Waiting for owner response.',
      '/projects',
      jsonb_build_object(
        'bid_id',       NEW.id,
        'project_id',   NEW.project_id,
        'amount',       NEW.total_price,
        'contractor_id', NEW.contractor_id
      )
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- trigger trigger_notify_new_bid (AFTER INSERT ON bids) already exists.

-- ─── 4. Req 4 (reject) + Req 6 (owner accept confirm): bid status changes ─────
CREATE OR REPLACE FUNCTION notify_bid_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_project_title   text;
  v_owner_id        uuid;
  v_contractor_name text;
BEGIN
  SELECT title, owner_id INTO v_project_title, v_owner_id FROM projects WHERE id = NEW.project_id;

  -- Req 4: a quote was rejected → respectful message to the contractor (once).
  IF NEW.status = 'rejected' AND OLD.status IS DISTINCT FROM 'rejected' THEN
    IF NOT EXISTS (
      SELECT 1 FROM notifications
      WHERE user_id = NEW.contractor_id
        AND type = 'bid_rejected'
        AND metadata->>'bid_id' = NEW.id::text
    ) THEN
      INSERT INTO notifications (user_id, type, title, message, link, metadata)
      VALUES (
        NEW.contractor_id,
        'bid_rejected',
        'Update on your quote',
        'Thank you for your quote on "' || COALESCE(v_project_title, 'the project')
          || '". The owner has decided to proceed with another contractor this time. '
          || 'We appreciate your effort and will keep sending you relevant projects.',
        '/projects',
        jsonb_build_object(
          'bid_id',        NEW.id,
          'project_id',    NEW.project_id,
          'contractor_id', NEW.contractor_id
        )
      );
    END IF;
  END IF;

  -- Req 6: a quote was accepted → confirmation to the OWNER (once).
  -- (The contractor's "accepted" notification is created in the accept flow.)
  IF NEW.status = 'accepted' AND OLD.status IS DISTINCT FROM 'accepted' THEN
    SELECT full_name INTO v_contractor_name FROM profiles WHERE id = NEW.contractor_id;
    IF v_owner_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM notifications
      WHERE user_id = v_owner_id
        AND type = 'project_update'
        AND metadata->>'kind' = 'quote_accepted_owner'
        AND metadata->>'bid_id' = NEW.id::text
    ) THEN
      INSERT INTO notifications (user_id, type, title, message, link, metadata)
      VALUES (
        v_owner_id,
        'project_update',
        'Quote accepted',
        'You accepted ' || COALESCE(v_contractor_name, 'the contractor') || '''s quote of $'
          || TO_CHAR(NEW.total_price, 'FM999,999,999')
          || ' for "' || COALESCE(v_project_title, 'your project')
          || '". Next: complete the secure deposit to activate the project.',
        '/project/' || NEW.project_id,
        jsonb_build_object(
          'kind',          'quote_accepted_owner',
          'bid_id',        NEW.id,
          'project_id',    NEW.project_id,
          'contractor_id', NEW.contractor_id
        )
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_notify_bid_status_change ON bids;
CREATE TRIGGER trigger_notify_bid_status_change
  AFTER UPDATE OF status ON bids
  FOR EACH ROW
  EXECUTE FUNCTION notify_bid_status_change();

-- ─── 5. Req 5: project opens for bids → confirmation to the OWNER ─────────────
-- Separate trigger from the contractor broadcast; same fire-once guard so it
-- runs exactly when the project becomes seeking_quotes.
CREATE OR REPLACE FUNCTION notify_owner_project_created()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM 'seeking_quotes' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'seeking_quotes' THEN
    RETURN NEW;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM notifications
    WHERE user_id = NEW.owner_id
      AND type = 'project_update'
      AND metadata->>'kind' = 'project_created'
      AND metadata->>'project_id' = NEW.id::text
  ) THEN
    INSERT INTO notifications (user_id, type, title, message, link, metadata)
    VALUES (
      NEW.owner_id,
      'project_update',
      '✅ Your project is live',
      '"' || NEW.title || '" is now open and visible to matching contractors. '
        || 'We''ll notify you as soon as a contractor sends a quote.',
      '/project/' || NEW.id,
      jsonb_build_object('kind', 'project_created', 'project_id', NEW.id)
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_notify_owner_project_created ON projects;
CREATE TRIGGER trigger_notify_owner_project_created
  AFTER INSERT OR UPDATE OF status ON projects
  FOR EACH ROW
  EXECUTE FUNCTION notify_owner_project_created();
