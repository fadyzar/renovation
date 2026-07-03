/*
  # Contractor onboarding: state/city, welcome-on-completion, team "new contractor"

  Fixes (contractor onboarding only — owner/contractor project/quote/payment flows
  are untouched):

  1. profiles gains `state` + `city` (the onboarding form collected them but never
     saved them). Available to admin via the profile record; used later for matching.

  2. Welcome for CONTRACTORS moves from signup (INSERT — no phone yet, so WhatsApp
     was always skipped) to ONBOARDING COMPLETION, so they get BOTH the welcome
     email AND the welcome WhatsApp. Owners keep their signup welcome unchanged.
     Fired via the EXISTING notifications dispatcher (not bypassed), once only.

  3. A new internal Team Alert ("New Contractor Joined") is enqueued when a
     contractor completes onboarding — once, idempotent (reuses team_alerts).

  Idempotent migration.
*/

-- ─── 1. profiles: state + city ───────────────────────────────────────────────
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS state text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS city  text;

-- ─── 2a. Welcome at signup → owners only (contractors welcomed post-onboarding)
CREATE OR REPLACE FUNCTION public.notify_welcome()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_first text; v_msg text;
BEGIN
  -- Contractors are welcomed after onboarding (notify_contractor_onboarded), once
  -- we have their phone for WhatsApp. Only owners are welcomed at signup here.
  IF NEW.role <> 'property_owner' THEN RETURN NEW; END IF;

  IF EXISTS (SELECT 1 FROM notifications WHERE user_id = NEW.id AND type = 'welcome') THEN
    RETURN NEW;
  END IF;

  v_first := COALESCE(NULLIF(split_part(NEW.full_name, ' ', 1), ''), 'there');
  v_msg := 'Welcome to M.G.BIT, ' || v_first || '! 🎉' || E'\n\n'
        || 'Your account is ready. Post your renovation project and start receiving bids from verified contractors.';

  INSERT INTO notifications (user_id, type, title, message, link, metadata)
  VALUES (NEW.id, 'welcome', 'Welcome to M.G.BIT 🎉', v_msg, '/', jsonb_build_object('role', NEW.role));

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'notify_welcome failed for %: %', NEW.id, SQLERRM;
  RETURN NEW;
END; $$;
-- trigger trigger_notify_welcome_insert (AFTER INSERT ON profiles) already binds this.

-- ─── 2b/3. On contractor onboarding completion: welcome + team alert (once) ────
CREATE OR REPLACE FUNCTION public.notify_contractor_onboarded()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_first text; v_msg text;
BEGIN
  IF NEW.role <> 'contractor' THEN RETURN NEW; END IF;
  IF NEW.onboarding_completed IS NOT TRUE THEN RETURN NEW; END IF;
  IF OLD.onboarding_completed IS TRUE THEN RETURN NEW; END IF;   -- only on false/null → true

  -- Welcome (once) through the existing dispatcher → email + WhatsApp
  IF NOT EXISTS (SELECT 1 FROM notifications WHERE user_id = NEW.id AND type = 'welcome') THEN
    v_first := COALESCE(NULLIF(split_part(NEW.full_name, ' ', 1), ''), 'there');
    v_msg := 'Welcome to M.G.BIT, ' || v_first || '! 🎉' || E'\n\n'
          || 'Your contractor profile is live. New projects that match your trade and area will appear in your dashboard — log in to browse and submit bids.';
    INSERT INTO notifications (user_id, type, title, message, link, metadata)
    VALUES (NEW.id, 'welcome', 'Welcome to M.G.BIT 🎉', v_msg, '/', jsonb_build_object('role', 'contractor'));
  END IF;

  -- Internal team alert (once, idempotent via team_alerts.idempotency_key)
  PERFORM enqueue_team_alert('contractor_joined', NEW.id, 'contractor_joined:' || NEW.id,
    jsonb_build_object('profile_id', NEW.id));

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'notify_contractor_onboarded failed for %: %', NEW.id, SQLERRM;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trigger_notify_contractor_onboarded ON profiles;
CREATE TRIGGER trigger_notify_contractor_onboarded
  AFTER UPDATE OF onboarding_completed ON profiles
  FOR EACH ROW EXECUTE FUNCTION public.notify_contractor_onboarded();
