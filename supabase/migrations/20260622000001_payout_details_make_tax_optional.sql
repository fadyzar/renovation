/*
  # Make contractor tax id optional on payout details

  Bank/tax info is no longer collected at signup. The payout form is shown only
  when a payment has actually been approved for the contractor, and the SSN/EIN
  field was removed from it. Relax the NOT NULL constraints so a payout row can
  be saved with banking details alone; tax id can be collected later if needed.

  Idempotent: DROP NOT NULL is safe to re-run.
*/

ALTER TABLE contractor_payout_details ALTER COLUMN tax_id_type  DROP NOT NULL;
ALTER TABLE contractor_payout_details ALTER COLUMN tax_id_value DROP NOT NULL;
