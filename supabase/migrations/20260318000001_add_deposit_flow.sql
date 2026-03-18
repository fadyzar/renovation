/*
  # Deposit Flow — Awaiting Contractor Deposit Stage

  ## Changes

  ### 1. project_status ENUM
  Adds `awaiting_deposit` between `seeking_quotes` and `in_progress`.
  This represents the state where the owner accepted a bid but the
  contractor has not yet paid their 10% security deposit.

  Flow:
    seeking_quotes → awaiting_deposit → in_progress → completed

  ### 2. payments table enhancements
  Adds deposit-specific tracking columns:
  - `is_deposit`          — whether this payment is the initial 10% deposit
  - `deposit_percentage`  — the deposit % (default 10, ready for config)
  - `mock_transaction_id` — transaction ID from mock/real provider
  - `paid_at`             — when payment was confirmed
  - `payment_method_last4`— last 4 digits of card used (for receipt display)

  ### 3. RLS policy
  Contractors need INSERT permission to create their own deposit payment records.

  ### Future real payment integration
  Replace `mock_transaction_id` → `payment_transaction_id`
  Add `stripe_payment_intent_id` (column already exists in original migration)
  The `paid_at` column and `is_deposit` flag remain valid for any provider.
*/

-- ─── 1. Add awaiting_deposit to project_status enum ───────────────────────────

ALTER TYPE project_status ADD VALUE IF NOT EXISTS 'awaiting_deposit' BEFORE 'in_progress';

-- ─── 2. Payments table deposit tracking columns ───────────────────────────────

ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS is_deposit boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS deposit_percentage numeric(5,2) NOT NULL DEFAULT 10.00,
  ADD COLUMN IF NOT EXISTS mock_transaction_id text,
  ADD COLUMN IF NOT EXISTS paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS payment_method_last4 text;

-- ─── 3. Allow contractors to INSERT their own deposit payments ─────────────────
-- The existing "Owners create payments" policy covers owner_id inserts.
-- This new policy allows contractor-initiated deposit records.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'payments'
      AND policyname = 'Contractors create deposit payments'
  ) THEN
    EXECUTE $$
      CREATE POLICY "Contractors create deposit payments"
        ON payments FOR INSERT
        TO authenticated
        WITH CHECK (auth.uid() = contractor_id AND is_deposit = true)
    $$;
  END IF;
END $$;

-- ─── 4. Index on is_deposit for quick deposit lookup ──────────────────────────

CREATE INDEX IF NOT EXISTS idx_payments_is_deposit ON payments(is_deposit) WHERE is_deposit = true;
CREATE INDEX IF NOT EXISTS idx_payments_paid_at ON payments(paid_at);
