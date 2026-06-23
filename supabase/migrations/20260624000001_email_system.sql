/*
  # Email notification system — logging columns, welcome-on-signup, relevance

  1. Extend email_logs with template/type + related job/bid ids.
  2. Welcome email fires once, on profile creation (registration), for owners &
     contractors. (Was previously tied to onboarding/phone.)
  3. New-project broadcast targets only RELEVANT contractors (specialties that
     overlap the project's work types) and tags metadata.kind='new_project' so
     the dispatcher renders the rich "new project" email template.

  Idempotent.
*/

-- ─── 1. email_logs columns ────────────────────────────────────────────────────
ALTER TABLE email_logs ADD COLUMN IF NOT EXISTS type       text;
ALTER TABLE email_logs ADD COLUMN IF NOT EXISTS project_id uuid;
ALTER TABLE email_logs ADD COLUMN IF NOT EXISTS bid_id     uuid;

-- ─── 2. Welcome on registration (once, owners & contractors) ──────────────────
-- Wrapped so it can NEVER break signup (it runs inside the auth→profile insert).
CREATE OR REPLACE FUNCTION public.notify_welcome()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_first text;
  v_msg   text;
BEGIN
  IF NEW.role NOT IN ('property_owner', 'contractor') THEN
    RETURN NEW;
  END IF;

  -- Once per user.
  IF EXISTS (SELECT 1 FROM notifications WHERE user_id = NEW.id AND type = 'welcome') THEN
    RETURN NEW;
  END IF;

  v_first := COALESCE(NULLIF(split_part(NEW.full_name, ' ', 1), ''), 'there');

  IF NEW.role = 'contractor' THEN
    v_msg := 'Welcome to M.G.BIT, ' || v_first || '! 🎉' || E'\n\n'
          || 'Your contractor account is ready. New projects that match your trade and area will appear in your dashboard — log in to browse and submit bids.';
  ELSE
    v_msg := 'Welcome to M.G.BIT, ' || v_first || '! 🎉' || E'\n\n'
          || 'Your account is ready. Post your renovation project and start receiving bids from verified contractors.';
  END IF;

  INSERT INTO notifications (user_id, type, title, message, link, metadata)
  VALUES (NEW.id, 'welcome', 'Welcome to M.G.BIT 🎉', v_msg, '/', jsonb_build_object('role', NEW.role));

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'notify_welcome failed for %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

-- Fire only on INSERT (new signups). Drop the old phone-UPDATE trigger so we
-- never "welcome" pre-existing users when they edit their phone.
DROP TRIGGER IF EXISTS trigger_notify_welcome_update ON profiles;
DROP TRIGGER IF EXISTS trigger_notify_welcome_insert ON profiles;
CREATE TRIGGER trigger_notify_welcome_insert
  AFTER INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_welcome();

-- ─── 3. New-project broadcast → relevant contractors only ─────────────────────
CREATE OR REPLACE FUNCTION public.notify_contractors_new_project()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contractor RECORD;
  v_budget     text;
  v_location   text;
BEGIN
  -- Fire once, when the project becomes open for bids.
  IF NEW.status IS DISTINCT FROM 'seeking_quotes' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'seeking_quotes' THEN
    RETURN NEW;
  END IF;

  v_budget := CASE
    WHEN NEW.budget_min IS NOT NULL AND NEW.budget_max IS NOT NULL
      THEN '$' || TO_CHAR(NEW.budget_min, 'FM999,999,999') || '–$' || TO_CHAR(NEW.budget_max, 'FM999,999,999')
    WHEN NEW.budget_min IS NOT NULL
      THEN '$' || TO_CHAR(NEW.budget_min, 'FM999,999,999')
    ELSE 'Budget not specified'
  END;
  v_location := COALESCE(NEW.city, '');

  -- Relevant = specialties overlap the project's work types. If the project has
  -- no work types, fall back to notifying every contractor.
  FOR v_contractor IN
    SELECT id FROM profiles
    WHERE role = 'contractor'
      AND (
        NEW.work_types IS NULL
        OR cardinality(NEW.work_types) = 0
        OR specialties && NEW.work_types
      )
  LOOP
    INSERT INTO notifications (user_id, type, title, message, link, metadata)
    VALUES (
      v_contractor.id,
      'project_update',
      '🏗️ New Project Available',
      'A new project "' || NEW.title || '"'
        || CASE WHEN v_location <> '' THEN ' in ' || v_location ELSE '' END
        || ' is open for bids. Budget: ' || v_budget || '. Log in to review and submit your bid.',
      '/projects',
      jsonb_build_object('project_id', NEW.id, 'kind', 'new_project')
    );
  END LOOP;

  RETURN NEW;
END;
$$;

-- trigger trigger_notify_contractors_new_project already exists (AFTER INSERT OR
-- UPDATE OF status); replacing the function is enough.
