/*
  # Enhanced Escrow & Milestones Payment System

  ## Overview
  Enhances existing payment system with complete milestone workflow and escrow management
*/

-- Enhance transactions table
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transactions' AND column_name = 'total_amount') THEN
    ALTER TABLE transactions ADD COLUMN total_amount decimal(12,2);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transactions' AND column_name = 'platform_fee_percentage') THEN
    ALTER TABLE transactions ADD COLUMN platform_fee_percentage decimal(5,2) DEFAULT 10.00;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transactions' AND column_name = 'platform_fee_amount') THEN
    ALTER TABLE transactions ADD COLUMN platform_fee_amount decimal(12,2);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transactions' AND column_name = 'net_amount') THEN
    ALTER TABLE transactions ADD COLUMN net_amount decimal(12,2);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transactions' AND column_name = 'initial_deposit_paid') THEN
    ALTER TABLE transactions ADD COLUMN initial_deposit_paid boolean DEFAULT false;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transactions' AND column_name = 'initial_deposit_amount') THEN
    ALTER TABLE transactions ADD COLUMN initial_deposit_amount decimal(12,2);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transactions' AND column_name = 'terms_accepted_owner') THEN
    ALTER TABLE transactions ADD COLUMN terms_accepted_owner boolean DEFAULT false;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transactions' AND column_name = 'terms_accepted_contractor') THEN
    ALTER TABLE transactions ADD COLUMN terms_accepted_contractor boolean DEFAULT false;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transactions' AND column_name = 'completed_at') THEN
    ALTER TABLE transactions ADD COLUMN completed_at timestamptz;
  END IF;
END $$;

-- Add new milestone status values to enum
DO $$
BEGIN
  ALTER TYPE milestone_status ADD VALUE IF NOT EXISTS 'awaiting_approval';
  ALTER TYPE milestone_status ADD VALUE IF NOT EXISTS 'disputed';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Add new transaction status values to enum
DO $$
BEGIN
  ALTER TYPE transaction_status ADD VALUE IF NOT EXISTS 'active';
  ALTER TYPE transaction_status ADD VALUE IF NOT EXISTS 'completed';
  ALTER TYPE transaction_status ADD VALUE IF NOT EXISTS 'cancelled';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Enhance milestones table
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'milestones' AND column_name = 'transaction_id') THEN
    ALTER TABLE milestones ADD COLUMN transaction_id uuid REFERENCES transactions(id) ON DELETE CASCADE;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'milestones' AND column_name = 'order_index') THEN
    ALTER TABLE milestones ADD COLUMN order_index int;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'milestones' AND column_name = 'proof_of_work_url') THEN
    ALTER TABLE milestones ADD COLUMN proof_of_work_url text;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'milestones' AND column_name = 'proof_of_work_description') THEN
    ALTER TABLE milestones ADD COLUMN proof_of_work_description text;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'milestones' AND column_name = 'submitted_at') THEN
    ALTER TABLE milestones ADD COLUMN submitted_at timestamptz;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'milestones' AND column_name = 'approved_at') THEN
    ALTER TABLE milestones ADD COLUMN approved_at timestamptz;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'milestones' AND column_name = 'paid_at') THEN
    ALTER TABLE milestones ADD COLUMN paid_at timestamptz;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'milestones' AND column_name = 'auto_approve_deadline') THEN
    ALTER TABLE milestones ADD COLUMN auto_approve_deadline timestamptz;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'milestones' AND column_name = 'auto_approved') THEN
    ALTER TABLE milestones ADD COLUMN auto_approved boolean DEFAULT false;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'milestones' AND column_name = 'updated_at') THEN
    ALTER TABLE milestones ADD COLUMN updated_at timestamptz DEFAULT now();
  END IF;
END $$;

-- Escrow holds table
CREATE TABLE IF NOT EXISTS escrow_holds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  milestone_id uuid REFERENCES milestones(id) ON DELETE CASCADE,
  amount decimal(12,2) NOT NULL,
  platform_fee decimal(12,2) NOT NULL,
  net_amount decimal(12,2) NOT NULL,
  status text DEFAULT 'held' CHECK (status IN ('held', 'released', 'refunded')),
  payment_intent_id text,
  held_at timestamptz DEFAULT now(),
  released_at timestamptz,
  released_to uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now()
);

-- Milestone approvals table
CREATE TABLE IF NOT EXISTS milestone_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  milestone_id uuid NOT NULL REFERENCES milestones(id) ON DELETE CASCADE,
  approver_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  approval_token text UNIQUE NOT NULL,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'expired')),
  approval_type text DEFAULT 'manual' CHECK (approval_type IN ('manual', 'one_click', 'auto')),
  approved_at timestamptz,
  expires_at timestamptz,
  notes text,
  created_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_milestones_transaction ON milestones(transaction_id);
CREATE INDEX IF NOT EXISTS idx_milestones_order ON milestones(transaction_id, order_index);
CREATE INDEX IF NOT EXISTS idx_escrow_transaction ON escrow_holds(transaction_id);
CREATE INDEX IF NOT EXISTS idx_escrow_milestone ON escrow_holds(milestone_id);
CREATE INDEX IF NOT EXISTS idx_approvals_milestone ON milestone_approvals(milestone_id);
CREATE INDEX IF NOT EXISTS idx_approvals_token ON milestone_approvals(approval_token);

-- Enable RLS
ALTER TABLE escrow_holds ENABLE ROW LEVEL SECURITY;
ALTER TABLE milestone_approvals ENABLE ROW LEVEL SECURITY;

-- Escrow holds policies
CREATE POLICY "Users can view own escrow holds"
  ON escrow_holds FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM transactions t
      WHERE t.id = escrow_holds.transaction_id
      AND (t.owner_id = auth.uid() OR t.contractor_id = auth.uid())
    )
  );

CREATE POLICY "System can create escrow holds"
  ON escrow_holds FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM transactions t
      WHERE t.id = transaction_id
      AND (t.owner_id = auth.uid() OR t.contractor_id = auth.uid())
    )
  );

-- Milestone approvals policies
CREATE POLICY "Users can view own approvals"
  ON milestone_approvals FOR SELECT
  TO authenticated
  USING (
    auth.uid() = approver_id OR
    EXISTS (
      SELECT 1 FROM milestones m
      JOIN transactions t ON t.id = m.transaction_id
      WHERE m.id = milestone_approvals.milestone_id
      AND (t.owner_id = auth.uid() OR t.contractor_id = auth.uid())
    )
  );

CREATE POLICY "Owners can create approvals"
  ON milestone_approvals FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = approver_id);

CREATE POLICY "Owners can update approvals"
  ON milestone_approvals FOR UPDATE
  TO authenticated
  USING (auth.uid() = approver_id);

-- Function to auto-approve expired milestones
CREATE OR REPLACE FUNCTION auto_approve_expired_milestones()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE milestones
  SET 
    status = 'approved'::milestone_status,
    auto_approved = true,
    approved_at = now()
  WHERE 
    status = 'awaiting_approval'::milestone_status
    AND auto_approve_deadline < now()
    AND auto_approved = false;
END;
$$;

-- Function to calculate platform fee
CREATE OR REPLACE FUNCTION calculate_platform_fee(amount decimal, fee_percentage decimal DEFAULT 10.00)
RETURNS decimal
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN ROUND(amount * (fee_percentage / 100), 2);
END;
$$;

-- Trigger to update timestamps
CREATE OR REPLACE FUNCTION update_milestone_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_milestone_timestamp ON milestones;
CREATE TRIGGER update_milestone_timestamp
  BEFORE UPDATE ON milestones
  FOR EACH ROW
  EXECUTE FUNCTION update_milestone_timestamp();
