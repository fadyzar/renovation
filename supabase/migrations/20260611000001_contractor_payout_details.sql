/*
  # Contractor payout details + manual payout tracking

  ## Why
  Admin pays contractors manually (bank transfer). We collect each contractor's
  banking + tax info at signup, and track which owner payments have been paid out
  (net of the 10% platform commission).

  ## Security
  `profiles` is world-readable (SELECT USING true), so sensitive banking/tax data
  must NOT live there. It goes in a dedicated `contractor_payout_details` table
  with strict RLS: a contractor can read/write ONLY their own row. Admins read it
  through a service-role edge function (which bypasses RLS) — there is deliberately
  no broad admin SELECT policy on this table.

  Only a non-sensitive boolean (`payout_details_completed`) is mirrored onto
  `profiles`, purely to gate the UI.
*/

-- 1. Sensitive payout details (one row per contractor) ------------------------
CREATE TABLE IF NOT EXISTS contractor_payout_details (
  contractor_id   uuid PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  full_name       text NOT NULL,
  bank_name       text NOT NULL,
  account_number  text NOT NULL,
  routing_number  text NOT NULL,                 -- ABA
  account_type    text NOT NULL CHECK (account_type IN ('checking', 'savings')),
  email           text,
  phone           text,
  tax_id_type     text NOT NULL CHECK (tax_id_type IN ('ssn', 'ein')),
  tax_id_value    text NOT NULL,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

ALTER TABLE contractor_payout_details ENABLE ROW LEVEL SECURITY;

-- Contractor can see only their own row
DROP POLICY IF EXISTS "Contractor reads own payout details" ON contractor_payout_details;
CREATE POLICY "Contractor reads own payout details"
  ON contractor_payout_details FOR SELECT
  TO authenticated
  USING (contractor_id = auth.uid());

-- Contractor can insert their own row
DROP POLICY IF EXISTS "Contractor inserts own payout details" ON contractor_payout_details;
CREATE POLICY "Contractor inserts own payout details"
  ON contractor_payout_details FOR INSERT
  TO authenticated
  WITH CHECK (contractor_id = auth.uid());

-- Contractor can update their own row
DROP POLICY IF EXISTS "Contractor updates own payout details" ON contractor_payout_details;
CREATE POLICY "Contractor updates own payout details"
  ON contractor_payout_details FOR UPDATE
  TO authenticated
  USING (contractor_id = auth.uid())
  WITH CHECK (contractor_id = auth.uid());

-- 2. UI gating flag (non-sensitive) -------------------------------------------
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS payout_details_completed boolean NOT NULL DEFAULT false;

-- 3. Manual payout tracking on transactions -----------------------------------
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS payout_status text NOT NULL DEFAULT 'unpaid'
    CHECK (payout_status IN ('unpaid', 'paid')),
  ADD COLUMN IF NOT EXISTS payout_at   timestamptz,
  ADD COLUMN IF NOT EXISTS payout_note text;

CREATE INDEX IF NOT EXISTS idx_transactions_payout_status
  ON transactions (payout_status);
