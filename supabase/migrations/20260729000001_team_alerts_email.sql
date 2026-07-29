/*
  # Team alerts: WhatsApp → Email (Resend)

  Team alerts moved OFF WhatsApp (repeated automated blasts to several team
  numbers risked Meta/Green API blocking the sender). `dispatch-team-alert` now
  sends branded email via Resend only — it never calls WhatsApp/Green API.

  This migration is the schema/trigger half:
  - team roster gains `email` + `always_all` (phone becomes optional so an
    email-only recipient can exist);
  - new enqueue triggers so the team is emailed on client signup and on
    milestone payment (in addition to the existing new_project / new_quote /
    quote_accepted / quote_rejected / status_update / contractor_joined).

  Recipient DATA (who is on the list, their emails, Shlomi removed) is
  environment-specific and applied live, not here. Idempotent by design.
*/

-- Roster → email-capable
ALTER TABLE public.team_whatsapp_recipients ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE public.team_whatsapp_recipients ADD COLUMN IF NOT EXISTS always_all boolean NOT NULL DEFAULT false;
ALTER TABLE public.team_whatsapp_recipients ALTER COLUMN phone DROP NOT NULL;

-- New client (property owner) registered → team alert
CREATE OR REPLACE FUNCTION public.team_alert_owner_joined()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.role <> 'property_owner' THEN RETURN NEW; END IF;
  PERFORM enqueue_team_alert('owner_joined', NEW.id, 'owner_joined:' || NEW.id,
    jsonb_build_object('profile_id', NEW.id));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_team_alert_owner_joined ON public.profiles;
CREATE TRIGGER trigger_team_alert_owner_joined
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION team_alert_owner_joined();

-- Milestone payment received → team alert
CREATE OR REPLACE FUNCTION public.team_alert_payment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'paid' AND OLD.status IS DISTINCT FROM 'paid' THEN
    PERFORM enqueue_team_alert('payment', NEW.id, 'payment:' || NEW.id,
      jsonb_build_object('project_id', NEW.project_id, 'milestone_id', NEW.id,
                         'amount', NEW.amount, 'title', NEW.title));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_team_alert_payment ON public.milestones;
CREATE TRIGGER trigger_team_alert_payment
  AFTER UPDATE ON public.milestones
  FOR EACH ROW EXECUTE FUNCTION team_alert_payment();
