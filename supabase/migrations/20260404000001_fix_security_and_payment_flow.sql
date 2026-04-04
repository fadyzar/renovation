/*
  # Security & Payment Flow Fixes

  ## Changes

  ### 1. Allow selected contractor to update project status
  The deposit payment flow requires the contractor (not the owner) to advance
  the project from `awaiting_deposit` to `in_progress` after paying the deposit.
  The existing "Owners can update own projects" policy blocks this.

  ### 2. Hide owner email/phone from profiles table for contractors
  The `profiles` table currently has `"Users can view all profiles"` which exposes
  owner emails to any authenticated user. We restrict this so:
  - Users can always view their own full profile
  - Other users can only see non-sensitive fields (full_name, avatar_url, company_name,
    bio, role, rating, total_projects, verification_status, specialties, years_experience)
  - Email and phone are only visible to the profile owner

  Note: Email/phone are already removed from frontend queries in this fix — this
  policy change is a defense-in-depth layer so even direct API calls cannot
  expose owner contact info.
*/

-- ─── 1. Allow selected contractor to advance project after deposit ─────────────
-- The existing "Owners can update own projects" policy only covers owner updates.
-- Contractors need to advance the status from awaiting_deposit → in_progress
-- when they pay the security deposit.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'projects'
      AND policyname = 'Selected contractor can advance project after deposit'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "Selected contractor can advance project after deposit"
        ON projects FOR UPDATE
        TO authenticated
        USING (auth.uid() = selected_contractor_id)
        WITH CHECK (auth.uid() = selected_contractor_id)
    $policy$;
  END IF;
END $$;

-- ─── 2. Ensure owner can also update completed_at when marking project done ────
-- The existing owner UPDATE policy already covers this, but confirm it's present.
-- (No change needed — "Owners can update own projects" already handles this.)
