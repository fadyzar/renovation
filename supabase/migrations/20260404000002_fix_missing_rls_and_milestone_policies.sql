/*
  # Fix Missing RLS Policies for Contractor Flow

  The remote database is missing several critical RLS policies that block the
  full deal flow. This migration adds them idempotently.

  ## Changes

  1. Allow selected contractor to advance project → in_progress after deposit
  2. Allow contractor to view milestones for their assigned projects
  3. Allow contractor to INSERT milestones (lazy-init from bid)
  4. Allow contractor to UPDATE milestones (submit proof of work)
  5. Allow owner to UPDATE milestones (approve, pay)
*/

DO $$ BEGIN

  -- 1. Contractor advances project: awaiting_deposit → in_progress
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'projects'
      AND policyname = 'Selected contractor can advance project after deposit'
  ) THEN
    EXECUTE $p$
      CREATE POLICY "Selected contractor can advance project after deposit"
        ON projects FOR UPDATE
        TO authenticated
        USING (auth.uid() = selected_contractor_id)
        WITH CHECK (auth.uid() = selected_contractor_id)
    $p$;
  END IF;

  -- 2. Contractors can SELECT milestones for their assigned projects
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'milestones'
      AND policyname = 'Contractors can view milestones for their projects'
  ) THEN
    EXECUTE $p$
      CREATE POLICY "Contractors can view milestones for their projects"
        ON milestones FOR SELECT
        TO authenticated
        USING (
          project_id IN (
            SELECT id FROM projects WHERE selected_contractor_id = auth.uid()
          )
        )
    $p$;
  END IF;

  -- 3. Contractors can INSERT milestones for their assigned projects
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'milestones'
      AND policyname = 'Contractors can insert milestones for their projects'
  ) THEN
    EXECUTE $p$
      CREATE POLICY "Contractors can insert milestones for their projects"
        ON milestones FOR INSERT
        TO authenticated
        WITH CHECK (
          project_id IN (
            SELECT id FROM projects WHERE selected_contractor_id = auth.uid()
          )
        )
    $p$;
  END IF;

  -- 4. Contractors can UPDATE milestones (submit proof, mark awaiting_approval)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'milestones'
      AND policyname = 'Contractors can update milestones for their projects'
  ) THEN
    EXECUTE $p$
      CREATE POLICY "Contractors can update milestones for their projects"
        ON milestones FOR UPDATE
        TO authenticated
        USING (
          project_id IN (
            SELECT id FROM projects WHERE selected_contractor_id = auth.uid()
          )
        )
        WITH CHECK (
          project_id IN (
            SELECT id FROM projects WHERE selected_contractor_id = auth.uid()
          )
        )
    $p$;
  END IF;

  -- 5. Owners can UPDATE milestones (approve, mark paid)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'milestones'
      AND policyname = 'Owners can update milestones for their projects'
  ) THEN
    EXECUTE $p$
      CREATE POLICY "Owners can update milestones for their projects"
        ON milestones FOR UPDATE
        TO authenticated
        USING (
          project_id IN (
            SELECT id FROM projects WHERE owner_id = auth.uid()
          )
        )
        WITH CHECK (
          project_id IN (
            SELECT id FROM projects WHERE owner_id = auth.uid()
          )
        )
    $p$;
  END IF;

END $$;
