/*
  # Server-side Notification Dispatch + Welcome flow

  Fixes the "WhatsApp sometimes arrives, sometimes not" problem by moving all
  outbound delivery OFF the browser and onto a single server-side path:

      notifications row inserted
        → AFTER INSERT trigger (this file)
        → pg_net async POST to the `dispatch-notification` edge function
        → WhatsApp + Email

  Also:
  - Consolidates the conflicting `notifications.type` CHECK constraints into one
    complete list (several earlier migrations redefined it with different sets).
  - Adds `dispatched_at` for idempotency / observability.
  - Adds a Welcome notification when a profile gains a phone (onboarding done).
  - Notifies the selected contractor (not just admins) when a project activates.

  Secrets (edge function URL + shared secret) live in `private.app_config`,
  populated out-of-band (NOT in this committed migration) so no secret hits git.
  If app_config is empty the trigger is a safe no-op — it never blocks inserts.
*/

-- ─── 0. Extensions ────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- ─── 1. notifications: dispatched_at + consolidated type constraint ───────────
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS dispatched_at timestamptz;

ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check CHECK (type IN (
  'welcome',
  'new_bid',
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

-- ─── 2. Private config table (edge fn URL + shared secret) ────────────────────
CREATE SCHEMA IF NOT EXISTS private;

CREATE TABLE IF NOT EXISTS private.app_config (
  key   text PRIMARY KEY,
  value text NOT NULL
);

-- Never expose this table through the API.
REVOKE ALL ON private.app_config FROM anon, authenticated;
ALTER TABLE private.app_config ENABLE ROW LEVEL SECURITY;

-- Seed keys so they're visible/known (values set out-of-band).
INSERT INTO private.app_config (key, value) VALUES
  ('dispatch_url',    ''),
  ('dispatch_secret', '')
ON CONFLICT (key) DO NOTHING;

-- ─── 3. Dispatch trigger: fan a new notification out to the edge function ─────
CREATE OR REPLACE FUNCTION public.dispatch_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, extensions
AS $$
DECLARE
  v_url    text;
  v_secret text;
BEGIN
  SELECT value INTO v_url    FROM private.app_config WHERE key = 'dispatch_url';
  SELECT value INTO v_secret FROM private.app_config WHERE key = 'dispatch_secret';

  -- Not configured yet → no-op. The in-app notification already exists; we just
  -- skip outbound delivery rather than break the originating transaction.
  IF v_url IS NULL OR v_url = '' THEN
    RETURN NEW;
  END IF;

  BEGIN
    PERFORM net.http_post(
      url     := v_url,
      headers := jsonb_build_object(
                   'Content-Type',    'application/json',
                   'x-webhook-secret', COALESCE(v_secret, '')
                 ),
      body    := jsonb_build_object('notification_id', NEW.id)
    );
  EXCEPTION WHEN OTHERS THEN
    -- pg_net problems must never roll back the business transaction.
    RAISE WARNING 'dispatch_notification failed for %: %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_dispatch_notification ON notifications;
CREATE TRIGGER trigger_dispatch_notification
  AFTER INSERT ON notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.dispatch_notification();

-- ─── 4. Welcome notification when a profile gains a phone ─────────────────────
-- Phone is collected during onboarding (a profile UPDATE), not at signup, so we
-- fire welcome the moment we actually have contact details — covering both
-- channels at once. Guarded so it fires exactly once per profile.
CREATE OR REPLACE FUNCTION public.notify_welcome()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_first_name text;
  v_msg        text;
BEGIN
  -- Only when phone transitions empty → present.
  IF COALESCE(NEW.phone, '') = '' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND COALESCE(OLD.phone, '') <> '' THEN
    RETURN NEW;  -- phone was already set before
  END IF;

  -- Don't double-send if a welcome already exists for this user.
  IF EXISTS (SELECT 1 FROM notifications WHERE user_id = NEW.id AND type = 'welcome') THEN
    RETURN NEW;
  END IF;

  v_first_name := COALESCE(NULLIF(split_part(NEW.full_name, ' ', 1), ''), 'there');

  IF NEW.role = 'contractor' THEN
    v_msg := 'Welcome to M.G.BIT, ' || v_first_name || '! 🎉' || E'\n\n'
          || 'Your contractor account is ready. New projects that match your expertise will appear in your dashboard — log in to browse and submit bids.';
  ELSE
    v_msg := 'Welcome to M.G.BIT, ' || v_first_name || '! 🎉' || E'\n\n'
          || 'Your account is ready. Post your renovation project and start receiving bids from verified contractors.';
  END IF;

  INSERT INTO notifications (user_id, type, title, message, link, metadata)
  VALUES (
    NEW.id,
    'welcome',
    'Welcome to M.G.BIT 🎉',
    v_msg,
    '/',
    jsonb_build_object('role', NEW.role)
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_notify_welcome_update ON profiles;
CREATE TRIGGER trigger_notify_welcome_update
  AFTER UPDATE OF phone ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_welcome();

DROP TRIGGER IF EXISTS trigger_notify_welcome_insert ON profiles;
CREATE TRIGGER trigger_notify_welcome_insert
  AFTER INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_welcome();

-- ─── 5. Notify the selected contractor when a project activates ───────────────
-- Existing notify_admins_payment() only notified admins; the contractor's
-- "project active" WhatsApp used to be sent from the browser. Add a DB row so
-- it flows through the unified dispatcher instead.
CREATE OR REPLACE FUNCTION public.notify_admins_payment()
RETURNS TRIGGER AS $$
DECLARE
  v_admin     RECORD;
  v_proj_title text;
BEGIN
  IF NEW.status = 'in_progress' AND OLD.status IS DISTINCT FROM 'in_progress' THEN
    v_proj_title := NEW.title;

    -- Admins
    FOR v_admin IN SELECT id FROM profiles WHERE role = 'admin' LOOP
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

    -- Selected contractor
    IF NEW.selected_contractor_id IS NOT NULL THEN
      INSERT INTO notifications (user_id, type, title, message, link, metadata)
      VALUES (
        NEW.selected_contractor_id,
        'project_activated',
        '✅ Project Active!',
        '"' || v_proj_title || '" is now active — the owner has made the first payment. You can now chat directly with the owner through the platform.',
        '/project/' || NEW.id,
        jsonb_build_object('project_id', NEW.id)
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- trigger trigger_notify_admins_payment already exists from a prior migration
-- and points at this function; replacing the function is enough.

-- ─── 6. Notify all contractors when a new project is posted ───────────────────
-- Previously contractors only got an email (client-triggered, best-effort).
-- Now every contractor gets an in-app row that the dispatcher delivers to
-- WhatsApp + email reliably from the server.
CREATE OR REPLACE FUNCTION public.notify_contractors_new_project()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contractor RECORD;
  v_owner_name text;
  v_budget     text;
  v_location   text;
BEGIN
  SELECT full_name INTO v_owner_name FROM profiles WHERE id = NEW.owner_id;

  v_budget := CASE
    WHEN NEW.budget_min IS NOT NULL AND NEW.budget_max IS NOT NULL
      THEN '$' || TO_CHAR(NEW.budget_min, 'FM999,999,999') || '–$' || TO_CHAR(NEW.budget_max, 'FM999,999,999')
    WHEN NEW.budget_min IS NOT NULL
      THEN '$' || TO_CHAR(NEW.budget_min, 'FM999,999,999')
    ELSE 'Budget not specified'
  END;

  -- Only fire when the project becomes open for bids, exactly once:
  --   INSERT directly as seeking_quotes, or UPDATE draft → seeking_quotes.
  IF NEW.status IS DISTINCT FROM 'seeking_quotes' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'seeking_quotes' THEN
    RETURN NEW;
  END IF;

  v_location := COALESCE(NEW.city, '');

  FOR v_contractor IN SELECT id FROM profiles WHERE role = 'contractor' LOOP
    INSERT INTO notifications (user_id, type, title, message, link, metadata)
    VALUES (
      v_contractor.id,
      'project_update',
      '🏗️ New Project Available',
      'A new project "' || NEW.title || '"'
        || CASE WHEN v_location <> '' THEN ' in ' || v_location ELSE '' END
        || ' is open for bids. Budget: ' || v_budget || '. Log in to review and submit your bid.',
      '/projects',
      jsonb_build_object('project_id', NEW.id)
    );
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_notify_contractors_new_project ON projects;
CREATE TRIGGER trigger_notify_contractors_new_project
  AFTER INSERT OR UPDATE OF status ON projects
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_contractors_new_project();
