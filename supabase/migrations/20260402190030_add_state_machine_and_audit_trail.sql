/*
  # State Machine & Audit Trail System

  ## Overview
  Enforces strict state machine for transactions and milestones with complete audit trail

  ## State Machines
  
  ### Transaction States
  - pending: Initial creation, no deposit yet
  - awaiting_deposit: Waiting for initial deposit
  - active: Deposit paid, work can begin
  - completed: All milestones completed and paid
  - cancelled: Transaction cancelled
  - disputed: Under dispute
  
  ### Milestone States
  - pending: Created but not yet active
  - in_progress: Contractor is working on it
  - awaiting_approval: Contractor submitted proof, waiting for owner approval
  - approved: Owner approved, ready to release funds
  - paid: Funds released to contractor
  - disputed: Under dispute
  - revision_requested: Owner requested changes
  
  ### Escrow Hold States
  - held: Funds are held in escrow
  - released: Funds released to contractor
  - refunded: Funds refunded to owner
  
  ## New Tables
  1. **audit_trail** - Complete audit log for all state changes
  
  ## Security
  - State transitions are validated
  - All changes are logged
  - RLS enabled
*/

-- Create audit trail table
CREATE TABLE IF NOT EXISTS audit_trail (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL CHECK (entity_type IN ('transaction', 'milestone', 'escrow_hold', 'approval', 'payment')),
  entity_id uuid NOT NULL,
  action text NOT NULL,
  old_state jsonb,
  new_state jsonb,
  actor_id uuid REFERENCES profiles(id),
  metadata jsonb DEFAULT '{}'::jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamptz DEFAULT now()
);

-- Indexes for audit trail
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_trail(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_trail(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_trail(created_at DESC);

-- Enable RLS
ALTER TABLE audit_trail ENABLE ROW LEVEL SECURITY;

-- Audit trail policies
CREATE POLICY "Admins can view all audit logs"
  ON audit_trail FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Users can view their own audit logs"
  ON audit_trail FOR SELECT
  TO authenticated
  USING (actor_id = auth.uid());

CREATE POLICY "System can create audit logs"
  ON audit_trail FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Function to log audit trail
CREATE OR REPLACE FUNCTION log_audit(
  p_entity_type text,
  p_entity_id uuid,
  p_action text,
  p_old_state jsonb DEFAULT NULL,
  p_new_state jsonb DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_audit_id uuid;
BEGIN
  INSERT INTO audit_trail (
    entity_type,
    entity_id,
    action,
    old_state,
    new_state,
    actor_id,
    metadata
  ) VALUES (
    p_entity_type,
    p_entity_id,
    p_action,
    p_old_state,
    p_new_state,
    auth.uid(),
    p_metadata
  )
  RETURNING id INTO v_audit_id;
  
  RETURN v_audit_id;
END;
$$;

-- Add state machine constraints to transactions
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS valid_transaction_status_transition;

-- Add trigger to validate transaction state transitions
CREATE OR REPLACE FUNCTION validate_transaction_state_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_old_status text;
  v_new_status text;
  v_allowed boolean := false;
BEGIN
  v_old_status := OLD.status;
  v_new_status := NEW.status;
  
  -- If status hasn't changed, allow
  IF v_old_status = v_new_status THEN
    RETURN NEW;
  END IF;
  
  -- Valid transitions
  v_allowed := CASE
    -- From pending
    WHEN v_old_status = 'pending' AND v_new_status IN ('escrowed', 'cancelled') THEN true
    -- From escrowed
    WHEN v_old_status = 'escrowed' AND v_new_status IN ('active', 'cancelled', 'refunded') THEN true
    -- From active
    WHEN v_old_status = 'active' AND v_new_status IN ('completed', 'disputed', 'cancelled') THEN true
    -- From disputed
    WHEN v_old_status = 'disputed' AND v_new_status IN ('active', 'cancelled', 'refunded') THEN true
    -- From completed
    WHEN v_old_status = 'completed' AND v_new_status IN ('disputed') THEN true
    ELSE false
  END;
  
  IF NOT v_allowed THEN
    RAISE EXCEPTION 'Invalid transaction state transition from % to %', v_old_status, v_new_status;
  END IF;
  
  -- Log the state change
  PERFORM log_audit(
    'transaction',
    NEW.id,
    'status_change',
    jsonb_build_object('status', v_old_status),
    jsonb_build_object('status', v_new_status),
    jsonb_build_object('from', v_old_status, 'to', v_new_status)
  );
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS transaction_state_validation ON transactions;
CREATE TRIGGER transaction_state_validation
  BEFORE UPDATE OF status ON transactions
  FOR EACH ROW
  EXECUTE FUNCTION validate_transaction_state_transition();

-- Add trigger to validate milestone state transitions
CREATE OR REPLACE FUNCTION validate_milestone_state_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_old_status milestone_status;
  v_new_status milestone_status;
  v_allowed boolean := false;
BEGIN
  v_old_status := OLD.status;
  v_new_status := NEW.status;
  
  -- If status hasn't changed, allow
  IF v_old_status = v_new_status THEN
    RETURN NEW;
  END IF;
  
  -- Valid transitions
  v_allowed := CASE
    -- From pending
    WHEN v_old_status = 'pending' AND v_new_status IN ('in_progress') THEN true
    -- From in_progress
    WHEN v_old_status = 'in_progress' AND v_new_status IN ('awaiting_approval', 'pending') THEN true
    -- From awaiting_approval
    WHEN v_old_status = 'awaiting_approval' AND v_new_status IN ('approved', 'in_progress', 'disputed') THEN true
    -- From approved
    WHEN v_old_status = 'approved' AND v_new_status IN ('paid', 'disputed') THEN true
    -- From disputed
    WHEN v_old_status = 'disputed' AND v_new_status IN ('in_progress', 'approved') THEN true
    ELSE false
  END;
  
  IF NOT v_allowed THEN
    RAISE EXCEPTION 'Invalid milestone state transition from % to %', v_old_status, v_new_status;
  END IF;
  
  -- Log the state change
  PERFORM log_audit(
    'milestone',
    NEW.id,
    'status_change',
    jsonb_build_object('status', v_old_status::text),
    jsonb_build_object('status', v_new_status::text),
    jsonb_build_object('from', v_old_status::text, 'to', v_new_status::text)
  );
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS milestone_state_validation ON milestones;
CREATE TRIGGER milestone_state_validation
  BEFORE UPDATE OF status ON milestones
  FOR EACH ROW
  EXECUTE FUNCTION validate_milestone_state_transition();

-- Function to safely calculate platform fee (server-side only)
CREATE OR REPLACE FUNCTION calculate_transaction_fees(
  p_total_amount decimal,
  p_platform_fee_percentage decimal DEFAULT 10.00
)
RETURNS TABLE (
  platform_fee_amount decimal,
  net_amount decimal
)
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ROUND(p_total_amount * (p_platform_fee_percentage / 100), 2) as platform_fee_amount,
    ROUND(p_total_amount - (p_total_amount * (p_platform_fee_percentage / 100)), 2) as net_amount;
END;
$$;
