/*
  # Contractor Milestone Insert Policy

  Allows contractors to INSERT payment_milestones for projects where they are
  the assigned contractor. This is needed so the ProjectPayments page can lazily
  initialize milestones from bid.milestones when either party first opens the page.

  Also adds a `contractor_note` column so contractors can attach a completion
  note when submitting a milestone for approval.
*/

-- Allow contractors to INSERT milestones for their own payments
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'payment_milestones'
      AND policyname = 'Contractors create milestones for their projects'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "Contractors create milestones for their projects"
        ON payment_milestones FOR INSERT
        TO authenticated
        WITH CHECK (
          payment_id IN (
            SELECT id FROM payments
            WHERE contractor_id = auth.uid()
          )
        )
    $policy$;
  END IF;
END $$;

-- Contractor note field (filled when submitting milestone for approval)
ALTER TABLE payment_milestones
  ADD COLUMN IF NOT EXISTS contractor_note text;

-- Owner note field (filled when approving / disputing a milestone)
ALTER TABLE payment_milestones
  ADD COLUMN IF NOT EXISTS owner_note text;

-- Track payout split for audit trail
ALTER TABLE payment_milestones
  ADD COLUMN IF NOT EXISTS platform_fee_amount  numeric(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS contractor_payout    numeric(10,2) DEFAULT 0;
