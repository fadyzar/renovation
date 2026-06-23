/*
  # Email delivery log

  Mirrors `whatsapp_logs` for the email channel so we can report how many
  notifications were emailed, how many failed, and keep the Resend message id
  for cross-referencing in the Resend dashboard.

  Service-role only: RLS enabled with no policies (the dispatch edge function
  writes via the service role, which bypasses RLS).
*/

CREATE TABLE IF NOT EXISTS email_logs (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id uuid,
  email        text,
  subject      text,
  status       text NOT NULL,        -- 'sent' | 'failed'
  error        text,
  provider_id  text,                 -- Resend message id
  created_at   timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_logs_created ON email_logs(created_at DESC);

ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;
