/*
  # Admin Notifications System

  1. Trigger: notify all admin users when a new project is created
  2. Extend notify_new_bid to also notify admins
  3. Add admin_config table for admin-specific settings (timeout hours)
*/

-- ─── 1. Admin config table ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS admin_config (
  key   text PRIMARY KEY,
  value text NOT NULL
);

INSERT INTO admin_config (key, value) VALUES
  ('bid_timeout_hours', '72'),    -- alert if no bids after N hours
  ('admin_whatsapp',    '')       -- admin WhatsApp phone (optional override)
ON CONFLICT (key) DO NOTHING;

-- Only admins can read/write
ALTER TABLE admin_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage config"
  ON admin_config FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- ─── 2. Notify all admins when new project created ────────────────────────────

CREATE OR REPLACE FUNCTION notify_admins_new_project()
RETURNS TRIGGER AS $$
DECLARE
  v_owner_name  text;
  v_admin       RECORD;
BEGIN
  SELECT full_name INTO v_owner_name FROM profiles WHERE id = NEW.owner_id;

  FOR v_admin IN
    SELECT id FROM profiles WHERE role = 'admin'
  LOOP
    INSERT INTO notifications (user_id, type, title, message, link, metadata)
    VALUES (
      v_admin.id,
      'project_update',
      '🏗️ New Project Posted',
      COALESCE(v_owner_name, 'A client') || ' posted "' || NEW.title || '" — budget $' || TO_CHAR(COALESCE(NEW.budget_min, 0), 'FM999,999,999'),
      '/admin',
      jsonb_build_object(
        'project_id', NEW.id,
        'owner_id',   NEW.owner_id,
        'budget',     NEW.budget_min
      )
    );
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_notify_admins_new_project ON projects;
CREATE TRIGGER trigger_notify_admins_new_project
  AFTER INSERT ON projects
  FOR EACH ROW
  EXECUTE FUNCTION notify_admins_new_project();

-- ─── 3. Extend notify_new_bid to also notify admins ──────────────────────────

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

  -- Notify project owner
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

  -- Notify all admins
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

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_notify_new_bid ON bids;
CREATE TRIGGER trigger_notify_new_bid
  AFTER INSERT ON bids
  FOR EACH ROW
  EXECUTE FUNCTION notify_new_bid();

-- ─── 4. Notify admins when project is activated (payment received) ────────────

CREATE OR REPLACE FUNCTION notify_admins_payment()
RETURNS TRIGGER AS $$
DECLARE
  v_admin     RECORD;
  v_proj_title text;
BEGIN
  -- Fires when project status changes to in_progress
  IF NEW.status = 'in_progress' AND OLD.status IS DISTINCT FROM 'in_progress' THEN
    v_proj_title := NEW.title;
    FOR v_admin IN
      SELECT id FROM profiles WHERE role = 'admin'
    LOOP
      INSERT INTO notifications (user_id, type, title, message, link, metadata)
      VALUES (
        v_admin.id,
        'payment_received',
        '💰 Payment Received — Project Active',
        '"' || v_proj_title || '" is now active. First payment collected.',
        '/admin',
        jsonb_build_object('project_id', NEW.id)
      );
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_notify_admins_payment ON projects;
CREATE TRIGGER trigger_notify_admins_payment
  AFTER UPDATE OF status ON projects
  FOR EACH ROW
  EXECUTE FUNCTION notify_admins_payment();
