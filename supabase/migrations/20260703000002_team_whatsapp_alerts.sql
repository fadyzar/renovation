/*
  # Internal MGbit Team WhatsApp Alerts (separate from owner/contractor notifs)

  A dedicated, DB-managed alert layer that pings the internal MGbit team on
  important platform activity — WITHOUT touching the existing owner/contractor
  notifications path.

  Flow (mirrors the existing notifications dispatcher, but its own tables/fn):
    business event (project/bid) → enqueue trigger → team_alerts row
      → AFTER INSERT trigger → pg_net → dispatch-team-alert edge fn
      → WhatsApp to every active team member with the matching alert flag.

  Idempotency: team_alerts.idempotency_key is UNIQUE and enqueues use
  ON CONFLICT DO NOTHING, so an event can enqueue at most one team alert;
  dispatched_at then guards against double delivery. Non-blocking: every enqueue
  is wrapped so it can never roll back the originating business transaction.

  Idempotent migration.
*/

-- ─── 1. Team roster (managed from the admin UI, never hardcoded) ──────────────
CREATE TABLE IF NOT EXISTS team_whatsapp_recipients (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name                    text NOT NULL,
  phone                   text NOT NULL UNIQUE,
  title                   text,
  is_active               boolean NOT NULL DEFAULT true,
  receive_project_alerts  boolean NOT NULL DEFAULT true,
  receive_quote_alerts    boolean NOT NULL DEFAULT true,
  receive_status_alerts   boolean NOT NULL DEFAULT true,
  receive_admin_messages  boolean NOT NULL DEFAULT true,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

-- keep updated_at fresh
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_team_recipients_touch ON team_whatsapp_recipients;
CREATE TRIGGER trg_team_recipients_touch
  BEFORE UPDATE ON team_whatsapp_recipients
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Seed the three team members (all active, all alerts on). Idempotent.
INSERT INTO team_whatsapp_recipients (name, phone, title) VALUES
  ('Itiya',  '+972535530957', 'Team'),
  ('Shlomi', '+972583285252', 'Team'),
  ('Gilad',  '+12137186695',  'Team')
ON CONFLICT (phone) DO NOTHING;

-- Admins manage the roster from the UI (service role bypasses RLS in the fn).
ALTER TABLE team_whatsapp_recipients ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins manage team recipients" ON team_whatsapp_recipients;
CREATE POLICY "Admins manage team recipients"
  ON team_whatsapp_recipients FOR ALL TO authenticated
  USING      (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- ─── 2. Team alert queue (idempotent event → one alert) ───────────────────────
CREATE TABLE IF NOT EXISTS team_alerts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type      text NOT NULL,           -- new_project | new_quote | quote_accepted | quote_rejected | status_update
  entity_id       uuid,                    -- project_id or bid_id
  idempotency_key text NOT NULL UNIQUE,    -- one alert per real event
  metadata        jsonb NOT NULL DEFAULT '{}'::jsonb,
  dispatched_at   timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE team_alerts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins read team alerts" ON team_alerts;
CREATE POLICY "Admins read team alerts"
  ON team_alerts FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- ─── 3. whatsapp_logs: recipient_name (for the team log view) ─────────────────
ALTER TABLE whatsapp_logs ADD COLUMN IF NOT EXISTS recipient_name text;

-- ─── 4. Config: team dispatch URL (value set out-of-band, like dispatch_url) ──
INSERT INTO private.app_config (key, value) VALUES ('team_dispatch_url', '')
ON CONFLICT (key) DO NOTHING;

-- ─── 5. Dispatch trigger: fan a new team_alert to the edge function ───────────
CREATE OR REPLACE FUNCTION public.dispatch_team_alert()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, private, extensions
AS $$
DECLARE v_url text; v_secret text;
BEGIN
  SELECT value INTO v_url    FROM private.app_config WHERE key = 'team_dispatch_url';
  SELECT value INTO v_secret FROM private.app_config WHERE key = 'dispatch_secret';
  IF v_url IS NULL OR v_url = '' THEN
    RETURN NEW;  -- not configured yet → no-op, never blocks
  END IF;
  BEGIN
    PERFORM net.http_post(
      url     := v_url,
      headers := jsonb_build_object('Content-Type','application/json','x-webhook-secret', COALESCE(v_secret,'')),
      body    := jsonb_build_object('team_alert_id', NEW.id)
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'dispatch_team_alert failed for %: %', NEW.id, SQLERRM;
  END;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trigger_dispatch_team_alert ON team_alerts;
CREATE TRIGGER trigger_dispatch_team_alert
  AFTER INSERT ON team_alerts
  FOR EACH ROW EXECUTE FUNCTION public.dispatch_team_alert();

-- ─── 6. Enqueue helper ────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.enqueue_team_alert(p_event text, p_entity uuid, p_key text, p_meta jsonb)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO team_alerts (event_type, entity_id, idempotency_key, metadata)
  VALUES (p_event, p_entity, p_key, COALESCE(p_meta, '{}'::jsonb))
  ON CONFLICT (idempotency_key) DO NOTHING;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'enqueue_team_alert(%,%) failed: %', p_event, p_entity, SQLERRM;
END; $$;

-- ─── 7. Event triggers (additive — existing notif triggers are untouched) ─────

-- New project opened for bids (fire once, same guard as the contractor broadcast)
CREATE OR REPLACE FUNCTION public.team_alert_new_project()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM 'seeking_quotes' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'seeking_quotes' THEN RETURN NEW; END IF;
  PERFORM enqueue_team_alert('new_project', NEW.id, 'new_project:'||NEW.id,
    jsonb_build_object('project_id', NEW.id));
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trigger_team_alert_new_project ON projects;
CREATE TRIGGER trigger_team_alert_new_project
  AFTER INSERT OR UPDATE OF status ON projects
  FOR EACH ROW EXECUTE FUNCTION public.team_alert_new_project();

-- Important project status changes
CREATE OR REPLACE FUNCTION public.team_alert_project_status()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NEW; END IF;
  IF NEW.status NOT IN ('awaiting_deposit','in_progress','completed','cancelled') THEN RETURN NEW; END IF;
  PERFORM enqueue_team_alert('status_update', NEW.id, 'status_update:'||NEW.id||':'||NEW.status,
    jsonb_build_object('project_id', NEW.id, 'status', NEW.status));
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trigger_team_alert_project_status ON projects;
CREATE TRIGGER trigger_team_alert_project_status
  AFTER UPDATE OF status ON projects
  FOR EACH ROW EXECUTE FUNCTION public.team_alert_project_status();

-- New quote submitted
CREATE OR REPLACE FUNCTION public.team_alert_new_quote()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM enqueue_team_alert('new_quote', NEW.id, 'new_quote:'||NEW.id,
    jsonb_build_object('bid_id', NEW.id, 'project_id', NEW.project_id));
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trigger_team_alert_new_quote ON bids;
CREATE TRIGGER trigger_team_alert_new_quote
  AFTER INSERT ON bids
  FOR EACH ROW EXECUTE FUNCTION public.team_alert_new_quote();

-- Quote accepted / rejected
CREATE OR REPLACE FUNCTION public.team_alert_bid_status()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'accepted' AND OLD.status IS DISTINCT FROM 'accepted' THEN
    PERFORM enqueue_team_alert('quote_accepted', NEW.id, 'quote_accepted:'||NEW.id,
      jsonb_build_object('bid_id', NEW.id, 'project_id', NEW.project_id));
  ELSIF NEW.status = 'rejected' AND OLD.status IS DISTINCT FROM 'rejected' THEN
    PERFORM enqueue_team_alert('quote_rejected', NEW.id, 'quote_rejected:'||NEW.id,
      jsonb_build_object('bid_id', NEW.id, 'project_id', NEW.project_id));
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trigger_team_alert_bid_status ON bids;
CREATE TRIGGER trigger_team_alert_bid_status
  AFTER UPDATE OF status ON bids
  FOR EACH ROW EXECUTE FUNCTION public.team_alert_bid_status();
