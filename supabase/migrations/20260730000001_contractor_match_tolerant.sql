/*
  # Robust "new project → matching contractors" notification

  The old matcher used exact array overlap (`specialties && work_types`). But the
  project category vocabulary and the contractor specialty vocabulary don't line
  up: projects are tagged "Kitchen" / "Exterior" while contractors declare
  "Kitchen Renovation" / "Exterior Painting". Result: a "Kitchen" project matched
  ZERO contractors and nobody was emailed.

  New matcher — no relevant contractor is ever missed:
    1. exact array overlap, OR
    2. case-insensitive substring match in EITHER direction
       ("Kitchen" ↔ "Kitchen Renovation", "Exterior" ↔ "Exterior Painting"), and
    3. never-silent fallback: if still nobody matches (e.g. an unmapped category
       like "Bedroom"), notify every contractor rather than none.
  Plus per-contractor+project dedup so a contractor is never emailed twice for
  the same project.
*/

CREATE OR REPLACE FUNCTION public.notify_contractors_new_project()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contractor RECORD;
  v_budget   text;
  v_location text;
  v_ids      uuid[];
BEGIN
  IF NEW.status IS DISTINCT FROM 'seeking_quotes' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'seeking_quotes' THEN RETURN NEW; END IF;

  v_budget := CASE
    WHEN NEW.budget_min IS NOT NULL AND NEW.budget_max IS NOT NULL
      THEN '$' || TO_CHAR(NEW.budget_min,'FM999,999,999') || '–$' || TO_CHAR(NEW.budget_max,'FM999,999,999')
    WHEN NEW.budget_min IS NOT NULL THEN '$' || TO_CHAR(NEW.budget_min,'FM999,999,999')
    ELSE 'Budget not specified' END;
  v_location := COALESCE(NEW.city,'');

  SELECT array_agg(p.id) INTO v_ids
  FROM profiles p
  WHERE p.role = 'contractor'
    AND (
      NEW.work_types IS NULL OR cardinality(NEW.work_types) = 0
      OR p.specialties && NEW.work_types
      OR EXISTS (
        SELECT 1 FROM unnest(NEW.work_types) w CROSS JOIN unnest(p.specialties) s
        WHERE s ILIKE '%'||w||'%' OR w ILIKE '%'||s||'%'
      )
    );

  IF v_ids IS NULL OR cardinality(v_ids) = 0 THEN
    SELECT array_agg(id) INTO v_ids FROM profiles WHERE role='contractor';
  END IF;

  FOR v_contractor IN SELECT unnest(v_ids) AS id LOOP
    IF NOT EXISTS (
      SELECT 1 FROM notifications
      WHERE user_id = v_contractor.id
        AND metadata->>'project_id' = NEW.id::text
        AND metadata->>'kind' = 'new_project'
    ) THEN
      INSERT INTO notifications (user_id, type, title, message, link, metadata)
      VALUES (
        v_contractor.id, 'project_update', '🏗️ New Project Available',
        'A new project "' || NEW.title || '"'
          || CASE WHEN v_location <> '' THEN ' in ' || v_location ELSE '' END
          || ' is open for bids. Budget: ' || v_budget || '. Log in to review and submit your bid.',
        '/projects',
        jsonb_build_object('project_id', NEW.id, 'kind', 'new_project')
      );
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;
