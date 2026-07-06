/*
  # Admin read access to email_logs

  email_logs has RLS enabled with no policies (service-role writes only). Add a
  read-only policy so admins can view the email log in the admin UI. The table
  holds no sensitive financial data — only recipient address, template type,
  status, Resend id, and related ids.
*/

DROP POLICY IF EXISTS "Admins read email logs" ON email_logs;
CREATE POLICY "Admins read email logs"
  ON email_logs FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
