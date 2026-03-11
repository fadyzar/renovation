/*
  # Escrow Payment System

  ## New Tables

  ### `payments`
  - Escrow payments for projects
  - Stripe integration
  - Milestone-based releases
  - Payment status tracking

  ### `payment_milestones`
  - Project payment milestones
  - Percentage-based or fixed amounts
  - Approval workflow

  ## Payment Flow
  1. Owner accepts bid and creates payment
  2. Funds held in escrow
  3. Contractor completes milestones
  4. Owner approves milestone
  5. Funds released to contractor

  ## Security
  - RLS enabled
  - Only project participants can view payments
  - Strict approval workflow
*/

-- Payments table
CREATE TABLE IF NOT EXISTS payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  bid_id uuid NOT NULL REFERENCES bids(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  contractor_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  total_amount numeric(10,2) NOT NULL CHECK (total_amount > 0),
  platform_fee numeric(10,2) DEFAULT 0,
  status text NOT NULL CHECK (status IN (
    'pending',
    'escrowed',
    'partially_released',
    'completed',
    'refunded',
    'disputed'
  )) DEFAULT 'pending',
  stripe_payment_intent_id text,
  stripe_customer_id text,
  stripe_account_id text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(project_id, bid_id)
);

-- Payment milestones table
CREATE TABLE IF NOT EXISTS payment_milestones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id uuid NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  amount numeric(10,2) NOT NULL CHECK (amount > 0),
  percentage numeric(5,2) CHECK (percentage >= 0 AND percentage <= 100),
  sequence_order integer NOT NULL DEFAULT 1,
  status text NOT NULL CHECK (status IN (
    'pending',
    'in_progress',
    'awaiting_approval',
    'approved',
    'released',
    'disputed'
  )) DEFAULT 'pending',
  contractor_submitted_at timestamptz,
  owner_approved_at timestamptz,
  released_at timestamptz,
  stripe_transfer_id text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_payments_project ON payments(project_id);
CREATE INDEX IF NOT EXISTS idx_payments_owner ON payments(owner_id);
CREATE INDEX IF NOT EXISTS idx_payments_contractor ON payments(contractor_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_milestones_payment ON payment_milestones(payment_id);
CREATE INDEX IF NOT EXISTS idx_milestones_status ON payment_milestones(status);

-- Enable RLS
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_milestones ENABLE ROW LEVEL SECURITY;

-- Payments policies
CREATE POLICY "Project participants view payments"
  ON payments FOR SELECT
  TO authenticated
  USING (auth.uid() = owner_id OR auth.uid() = contractor_id);

CREATE POLICY "Owners create payments"
  ON payments FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Participants update payments"
  ON payments FOR UPDATE
  TO authenticated
  USING (auth.uid() = owner_id OR auth.uid() = contractor_id);

-- Milestones policies
CREATE POLICY "Participants view milestones"
  ON payment_milestones FOR SELECT
  TO authenticated
  USING (
    payment_id IN (
      SELECT id FROM payments
      WHERE owner_id = auth.uid() OR contractor_id = auth.uid()
    )
  );

CREATE POLICY "Owners create milestones"
  ON payment_milestones FOR INSERT
  TO authenticated
  WITH CHECK (
    payment_id IN (
      SELECT id FROM payments WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "Participants update milestones"
  ON payment_milestones FOR UPDATE
  TO authenticated
  USING (
    payment_id IN (
      SELECT id FROM payments
      WHERE owner_id = auth.uid() OR contractor_id = auth.uid()
    )
  );

-- Function to update payment status based on milestones
CREATE OR REPLACE FUNCTION update_payment_status()
RETURNS TRIGGER AS $$
DECLARE
  total_milestones integer;
  released_milestones integer;
  payment_record RECORD;
BEGIN
  SELECT * INTO payment_record
  FROM payments
  WHERE id = COALESCE(NEW.payment_id, OLD.payment_id);

  SELECT COUNT(*) INTO total_milestones
  FROM payment_milestones
  WHERE payment_id = payment_record.id;

  SELECT COUNT(*) INTO released_milestones
  FROM payment_milestones
  WHERE payment_id = payment_record.id
  AND status = 'released';

  IF released_milestones = total_milestones AND total_milestones > 0 THEN
    UPDATE payments
    SET status = 'completed', updated_at = now()
    WHERE id = payment_record.id;
  ELSIF released_milestones > 0 THEN
    UPDATE payments
    SET status = 'partially_released', updated_at = now()
    WHERE id = payment_record.id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_payment_status ON payment_milestones;
CREATE TRIGGER trigger_update_payment_status
  AFTER UPDATE OF status ON payment_milestones
  FOR EACH ROW
  EXECUTE FUNCTION update_payment_status();

-- Function to notify on milestone approval
CREATE OR REPLACE FUNCTION notify_milestone_events()
RETURNS TRIGGER AS $$
DECLARE
  payment_record RECORD;
BEGIN
  SELECT * INTO payment_record
  FROM payments
  WHERE id = NEW.payment_id;

  IF NEW.status = 'awaiting_approval' AND OLD.status != 'awaiting_approval' THEN
    INSERT INTO notifications (user_id, type, title, message, link, metadata)
    VALUES (
      payment_record.owner_id,
      'project_update',
      'Milestone Completed',
      'Contractor completed: ' || NEW.title,
      '/payments/' || payment_record.id,
      jsonb_build_object('milestone_id', NEW.id, 'payment_id', payment_record.id)
    );
  END IF;

  IF NEW.status = 'released' AND OLD.status != 'released' THEN
    INSERT INTO notifications (user_id, type, title, message, link, metadata)
    VALUES (
      payment_record.contractor_id,
      'payment_received',
      'Payment Released',
      'Milestone payment released: $' || NEW.amount,
      '/payments/' || payment_record.id,
      jsonb_build_object('milestone_id', NEW.id, 'amount', NEW.amount)
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_notify_milestones ON payment_milestones;
CREATE TRIGGER trigger_notify_milestones
  AFTER UPDATE OF status ON payment_milestones
  FOR EACH ROW
  EXECUTE FUNCTION notify_milestone_events();
