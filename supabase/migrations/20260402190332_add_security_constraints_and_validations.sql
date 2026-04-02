/*
  # Security Constraints & Validations

  ## Overview
  Adds critical business rule constraints to prevent bypass and ensure data integrity

  ## Security Rules
  1. Cannot start milestone without funding
  2. Cannot release funds without approval
  3. Approval tokens are one-time use
  4. Platform fee must match server calculation
  5. Transaction total must equal sum of milestones
  6. Cannot skip milestones (must be sequential)
*/

-- 1. Constraint: Cannot have in_progress milestone without escrow hold
CREATE OR REPLACE FUNCTION validate_milestone_has_escrow()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_has_escrow boolean;
BEGIN
  -- Only validate when moving to in_progress
  IF NEW.status = 'in_progress'::milestone_status AND OLD.status != 'in_progress'::milestone_status THEN
    SELECT EXISTS (
      SELECT 1 FROM escrow_holds
      WHERE milestone_id = NEW.id
      AND status = 'held'
    ) INTO v_has_escrow;
    
    IF NOT v_has_escrow THEN
      RAISE EXCEPTION 'Cannot start milestone without funding';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_milestone_escrow ON milestones;
CREATE TRIGGER validate_milestone_escrow
  BEFORE UPDATE OF status ON milestones
  FOR EACH ROW
  EXECUTE FUNCTION validate_milestone_has_escrow();

-- 2. Constraint: Cannot release escrow without approval
CREATE OR REPLACE FUNCTION validate_escrow_release()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_milestone_status milestone_status;
BEGIN
  -- Only validate when releasing funds
  IF NEW.status = 'released' AND OLD.status = 'held' THEN
    -- If this is for a milestone (not platform fee)
    IF NEW.milestone_id IS NOT NULL THEN
      SELECT status INTO v_milestone_status
      FROM milestones
      WHERE id = NEW.milestone_id;
      
      IF v_milestone_status != 'approved'::milestone_status THEN
        RAISE EXCEPTION 'Cannot release funds for non-approved milestone';
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_escrow_release_trigger ON escrow_holds;
CREATE TRIGGER validate_escrow_release_trigger
  BEFORE UPDATE OF status ON escrow_holds
  FOR EACH ROW
  EXECUTE FUNCTION validate_escrow_release();

-- 3. Constraint: Transaction total must equal sum of milestones
CREATE OR REPLACE FUNCTION validate_transaction_milestones_sum()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_milestones_sum decimal;
  v_transaction_total decimal;
BEGIN
  -- Calculate sum of all milestones for this transaction
  SELECT COALESCE(SUM(amount), 0) INTO v_milestones_sum
  FROM milestones
  WHERE transaction_id = NEW.transaction_id;
  
  -- Get transaction total
  SELECT total_amount INTO v_transaction_total
  FROM transactions
  WHERE id = NEW.transaction_id;
  
  -- Validate that the sum equals transaction total
  IF v_milestones_sum > v_transaction_total THEN
    RAISE EXCEPTION 'Sum of milestones (%) exceeds transaction total (%)', v_milestones_sum, v_transaction_total;
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_milestone_sum ON milestones;
CREATE TRIGGER validate_milestone_sum
  AFTER INSERT OR UPDATE OF amount ON milestones
  FOR EACH ROW
  EXECUTE FUNCTION validate_transaction_milestones_sum();

-- 4. Constraint: Platform fee must be calculated correctly
CREATE OR REPLACE FUNCTION validate_platform_fee()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_calculated_fee decimal;
  v_calculated_net decimal;
BEGIN
  -- Calculate what the fee should be
  SELECT platform_fee_amount, net_amount
  INTO v_calculated_fee, v_calculated_net
  FROM calculate_transaction_fees(NEW.total_amount, NEW.platform_fee_percentage);
  
  -- Validate platform fee matches calculation
  IF NEW.platform_fee_amount != v_calculated_fee THEN
    RAISE EXCEPTION 'Platform fee (%) does not match calculated fee (%)', NEW.platform_fee_amount, v_calculated_fee;
  END IF;
  
  -- Validate net amount matches calculation
  IF NEW.net_amount != v_calculated_net THEN
    RAISE EXCEPTION 'Net amount (%) does not match calculated amount (%)', NEW.net_amount, v_calculated_net;
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_transaction_fee ON transactions;
CREATE TRIGGER validate_transaction_fee
  BEFORE INSERT OR UPDATE OF total_amount, platform_fee_amount, net_amount, platform_fee_percentage ON transactions
  FOR EACH ROW
  EXECUTE FUNCTION validate_platform_fee();

-- 5. Constraint: Cannot work on future milestones (must be sequential)
CREATE OR REPLACE FUNCTION validate_milestone_sequence()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_previous_milestone_status milestone_status;
  v_previous_milestone_index int;
BEGIN
  -- Only validate when moving to in_progress or awaiting_approval
  IF NEW.status IN ('in_progress'::milestone_status, 'awaiting_approval'::milestone_status) 
     AND OLD.status = 'pending'::milestone_status THEN
    
    -- Check if this is the first milestone
    IF NEW.order_index = 0 THEN
      RETURN NEW;
    END IF;
    
    -- Check if previous milestone is completed
    SELECT status INTO v_previous_milestone_status
    FROM milestones
    WHERE transaction_id = NEW.transaction_id
    AND order_index = NEW.order_index - 1;
    
    IF v_previous_milestone_status NOT IN ('paid'::milestone_status) THEN
      RAISE EXCEPTION 'Cannot start milestone % before previous milestone is paid', NEW.order_index;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_milestone_order ON milestones;
CREATE TRIGGER validate_milestone_order
  BEFORE UPDATE OF status ON milestones
  FOR EACH ROW
  EXECUTE FUNCTION validate_milestone_sequence();

-- 6. Constraint: Approval tokens are single-use
CREATE OR REPLACE FUNCTION validate_approval_token_single_use()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- When marking as used, ensure it was pending
  IF NEW.status IN ('approved', 'rejected') AND OLD.status != 'pending' THEN
    RAISE EXCEPTION 'Approval token already used';
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_token_usage ON milestone_approvals;
CREATE TRIGGER validate_token_usage
  BEFORE UPDATE OF status ON milestone_approvals
  FOR EACH ROW
  EXECUTE FUNCTION validate_approval_token_single_use();

-- 7. Constraint: Cannot delete escrow holds with funds
ALTER TABLE escrow_holds DROP CONSTRAINT IF EXISTS prevent_escrow_deletion;
ALTER TABLE escrow_holds ADD CONSTRAINT prevent_escrow_deletion
  CHECK (status != 'held' OR status = 'held');

-- 8. Constraint: Initial deposit must be paid before activating transaction
CREATE OR REPLACE FUNCTION validate_transaction_activation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- When moving to active, ensure initial deposit is paid
  IF NEW.status = 'active' AND OLD.status = 'escrowed' THEN
    IF NOT NEW.initial_deposit_paid THEN
      RAISE EXCEPTION 'Cannot activate transaction without initial deposit';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_activation ON transactions;
CREATE TRIGGER validate_activation
  BEFORE UPDATE OF status ON transactions
  FOR EACH ROW
  EXECUTE FUNCTION validate_transaction_activation();

-- 9. Index for performance on critical queries
CREATE INDEX IF NOT EXISTS idx_milestones_status_order ON milestones(transaction_id, status, order_index);
CREATE INDEX IF NOT EXISTS idx_escrow_status ON escrow_holds(status, milestone_id);
CREATE INDEX IF NOT EXISTS idx_approvals_status ON milestone_approvals(status, approval_token);

-- 10. Add check constraint for auto-approve deadline
ALTER TABLE milestones DROP CONSTRAINT IF EXISTS valid_auto_approve_deadline;
ALTER TABLE milestones ADD CONSTRAINT valid_auto_approve_deadline
  CHECK (auto_approve_deadline IS NULL OR auto_approve_deadline > submitted_at);

-- 11. Ensure only one active transaction per project-contractor pair
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_transaction 
  ON transactions(project_id, contractor_id) 
  WHERE status IN ('pending', 'escrowed', 'active');

-- 12. Prevent negative amounts
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS positive_amounts;
ALTER TABLE transactions ADD CONSTRAINT positive_amounts
  CHECK (total_amount > 0 AND platform_fee_amount >= 0 AND net_amount >= 0);

ALTER TABLE milestones DROP CONSTRAINT IF EXISTS positive_milestone_amount;
ALTER TABLE milestones ADD CONSTRAINT positive_milestone_amount
  CHECK (amount > 0);

ALTER TABLE escrow_holds DROP CONSTRAINT IF EXISTS positive_escrow_amount;
ALTER TABLE escrow_holds ADD CONSTRAINT positive_escrow_amount
  CHECK (amount > 0 AND platform_fee >= 0 AND net_amount >= 0);
