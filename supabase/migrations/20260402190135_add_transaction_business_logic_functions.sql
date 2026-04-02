/*
  # Transaction Business Logic Functions

  ## Overview
  Server-side functions for all transaction operations with proper validations

  ## Functions
  1. create_transaction - Creates transaction with milestones
  2. fund_initial_deposit - Records initial deposit payment
  3. start_milestone - Contractor starts working on milestone
  4. submit_milestone_proof - Contractor submits proof of work
  5. approve_milestone - Owner approves milestone
  6. request_milestone_revision - Owner requests changes
  7. release_milestone_funds - Release funds after approval
  8. fund_next_milestone - Owner funds next milestone
  9. generate_approval_token - Generate secure one-click approval token
  10. approve_milestone_by_token - Approve using one-click token
*/

-- 1. Create Transaction
CREATE OR REPLACE FUNCTION create_transaction(
  p_project_id uuid,
  p_contractor_id uuid,
  p_total_amount decimal,
  p_milestones jsonb -- Array of {title, description, amount, order_index}
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_transaction_id uuid;
  v_owner_id uuid;
  v_platform_fee decimal;
  v_net_amount decimal;
  v_first_milestone_amount decimal;
  v_initial_deposit decimal;
  v_milestone jsonb;
  v_milestone_id uuid;
BEGIN
  -- Validate caller is the project owner
  SELECT owner_id INTO v_owner_id
  FROM projects
  WHERE id = p_project_id;
  
  IF v_owner_id IS NULL THEN
    RAISE EXCEPTION 'Project not found';
  END IF;
  
  IF v_owner_id != auth.uid() THEN
    RAISE EXCEPTION 'Only project owner can create transaction';
  END IF;
  
  -- Calculate fees
  SELECT platform_fee_amount, net_amount
  INTO v_platform_fee, v_net_amount
  FROM calculate_transaction_fees(p_total_amount, 10.00);
  
  -- Get first milestone amount
  v_first_milestone_amount := (p_milestones->0->>'amount')::decimal;
  v_initial_deposit := v_platform_fee + v_first_milestone_amount;
  
  -- Create transaction
  INSERT INTO transactions (
    project_id,
    owner_id,
    contractor_id,
    total_amount,
    platform_fee_percentage,
    platform_fee_amount,
    net_amount,
    initial_deposit_amount,
    status
  ) VALUES (
    p_project_id,
    v_owner_id,
    p_contractor_id,
    p_total_amount,
    10.00,
    v_platform_fee,
    v_net_amount,
    v_initial_deposit,
    'pending'
  )
  RETURNING id INTO v_transaction_id;
  
  -- Create milestones
  FOR v_milestone IN SELECT * FROM jsonb_array_elements(p_milestones)
  LOOP
    INSERT INTO milestones (
      transaction_id,
      project_id,
      title,
      description,
      amount,
      order_index,
      status
    ) VALUES (
      v_transaction_id,
      p_project_id,
      v_milestone->>'title',
      v_milestone->>'description',
      (v_milestone->>'amount')::decimal,
      (v_milestone->>'order_index')::int,
      CASE WHEN (v_milestone->>'order_index')::int = 0 THEN 'pending'::milestone_status ELSE 'pending'::milestone_status END
    )
    RETURNING id INTO v_milestone_id;
  END LOOP;
  
  -- Log audit
  PERFORM log_audit(
    'transaction',
    v_transaction_id,
    'created',
    NULL,
    jsonb_build_object(
      'total_amount', p_total_amount,
      'platform_fee', v_platform_fee,
      'initial_deposit', v_initial_deposit,
      'milestone_count', jsonb_array_length(p_milestones)
    )
  );
  
  RETURN v_transaction_id;
END;
$$;

-- 2. Fund Initial Deposit
CREATE OR REPLACE FUNCTION fund_initial_deposit(
  p_transaction_id uuid,
  p_payment_intent_id text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_owner_id uuid;
  v_contractor_id uuid;
  v_deposit_amount decimal;
  v_platform_fee decimal;
  v_first_milestone_id uuid;
  v_first_milestone_amount decimal;
  v_escrow_id uuid;
BEGIN
  -- Validate caller is the owner
  SELECT owner_id, contractor_id, initial_deposit_amount, platform_fee_amount
  INTO v_owner_id, v_contractor_id, v_deposit_amount, v_platform_fee
  FROM transactions
  WHERE id = p_transaction_id;
  
  IF v_owner_id != auth.uid() THEN
    RAISE EXCEPTION 'Only transaction owner can fund deposit';
  END IF;
  
  -- Get first milestone
  SELECT id, amount INTO v_first_milestone_id, v_first_milestone_amount
  FROM milestones
  WHERE transaction_id = p_transaction_id
  ORDER BY order_index
  LIMIT 1;
  
  -- Create escrow hold for platform fee
  INSERT INTO escrow_holds (
    transaction_id,
    milestone_id,
    amount,
    platform_fee,
    net_amount,
    status,
    payment_intent_id
  ) VALUES (
    p_transaction_id,
    NULL,
    v_platform_fee,
    v_platform_fee,
    0,
    'held',
    p_payment_intent_id
  );
  
  -- Create escrow hold for first milestone
  INSERT INTO escrow_holds (
    transaction_id,
    milestone_id,
    amount,
    platform_fee,
    net_amount,
    status,
    payment_intent_id
  ) VALUES (
    p_transaction_id,
    v_first_milestone_id,
    v_first_milestone_amount,
    0,
    v_first_milestone_amount,
    'held',
    p_payment_intent_id
  )
  RETURNING id INTO v_escrow_id;
  
  -- Update transaction
  UPDATE transactions
  SET 
    initial_deposit_paid = true,
    status = 'escrowed',
    updated_at = now()
  WHERE id = p_transaction_id;
  
  -- Update first milestone to in_progress
  UPDATE milestones
  SET status = 'in_progress'
  WHERE id = v_first_milestone_id;
  
  -- Log audit
  PERFORM log_audit(
    'transaction',
    p_transaction_id,
    'initial_deposit_funded',
    NULL,
    jsonb_build_object(
      'amount', v_deposit_amount,
      'payment_intent_id', p_payment_intent_id,
      'escrow_id', v_escrow_id
    )
  );
  
  RETURN true;
END;
$$;

-- 3. Submit Milestone Proof
CREATE OR REPLACE FUNCTION submit_milestone_proof(
  p_milestone_id uuid,
  p_proof_url text,
  p_proof_description text,
  p_auto_approve_days int DEFAULT 5
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_transaction_id uuid;
  v_contractor_id uuid;
  v_auto_approve_deadline timestamptz;
BEGIN
  -- Validate caller is the contractor
  SELECT m.transaction_id, t.contractor_id
  INTO v_transaction_id, v_contractor_id
  FROM milestones m
  JOIN transactions t ON t.id = m.transaction_id
  WHERE m.id = p_milestone_id;
  
  IF v_contractor_id != auth.uid() THEN
    RAISE EXCEPTION 'Only assigned contractor can submit proof';
  END IF;
  
  -- Set auto-approve deadline
  v_auto_approve_deadline := now() + (p_auto_approve_days || ' days')::interval;
  
  -- Update milestone
  UPDATE milestones
  SET 
    proof_of_work_url = p_proof_url,
    proof_of_work_description = p_proof_description,
    submitted_at = now(),
    auto_approve_deadline = v_auto_approve_deadline,
    status = 'awaiting_approval'::milestone_status
  WHERE id = p_milestone_id;
  
  -- Log audit
  PERFORM log_audit(
    'milestone',
    p_milestone_id,
    'proof_submitted',
    NULL,
    jsonb_build_object(
      'proof_url', p_proof_url,
      'auto_approve_deadline', v_auto_approve_deadline
    )
  );
  
  RETURN true;
END;
$$;

-- 4. Approve Milestone
CREATE OR REPLACE FUNCTION approve_milestone(
  p_milestone_id uuid,
  p_notes text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_transaction_id uuid;
  v_owner_id uuid;
BEGIN
  -- Validate caller is the owner
  SELECT m.transaction_id, t.owner_id
  INTO v_transaction_id, v_owner_id
  FROM milestones m
  JOIN transactions t ON t.id = m.transaction_id
  WHERE m.id = p_milestone_id;
  
  IF v_owner_id != auth.uid() THEN
    RAISE EXCEPTION 'Only project owner can approve milestone';
  END IF;
  
  -- Update milestone
  UPDATE milestones
  SET 
    status = 'approved'::milestone_status,
    approved_at = now()
  WHERE id = p_milestone_id
  AND status = 'awaiting_approval'::milestone_status;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Milestone not in awaiting_approval state';
  END IF;
  
  -- Log audit
  PERFORM log_audit(
    'milestone',
    p_milestone_id,
    'approved',
    NULL,
    jsonb_build_object('notes', p_notes, 'approved_by', auth.uid())
  );
  
  RETURN true;
END;
$$;

-- 5. Request Milestone Revision
CREATE OR REPLACE FUNCTION request_milestone_revision(
  p_milestone_id uuid,
  p_revision_notes text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_transaction_id uuid;
  v_owner_id uuid;
BEGIN
  -- Validate caller is the owner
  SELECT m.transaction_id, t.owner_id
  INTO v_transaction_id, v_owner_id
  FROM milestones m
  JOIN transactions t ON t.id = m.transaction_id
  WHERE m.id = p_milestone_id;
  
  IF v_owner_id != auth.uid() THEN
    RAISE EXCEPTION 'Only project owner can request revision';
  END IF;
  
  -- Update milestone back to in_progress
  UPDATE milestones
  SET 
    status = 'in_progress'::milestone_status,
    proof_of_work_description = COALESCE(proof_of_work_description, '') || E'\n\n[Revision Requested]: ' || p_revision_notes
  WHERE id = p_milestone_id
  AND status = 'awaiting_approval'::milestone_status;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Milestone not in awaiting_approval state';
  END IF;
  
  -- Log audit
  PERFORM log_audit(
    'milestone',
    p_milestone_id,
    'revision_requested',
    NULL,
    jsonb_build_object('notes', p_revision_notes)
  );
  
  RETURN true;
END;
$$;

-- 6. Release Milestone Funds
CREATE OR REPLACE FUNCTION release_milestone_funds(
  p_milestone_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_transaction_id uuid;
  v_contractor_id uuid;
  v_escrow_id uuid;
  v_milestone_status milestone_status;
BEGIN
  -- Get milestone details
  SELECT m.transaction_id, m.status, t.contractor_id
  INTO v_transaction_id, v_milestone_status, v_contractor_id
  FROM milestones m
  JOIN transactions t ON t.id = m.transaction_id
  WHERE m.id = p_milestone_id;
  
  -- Validate milestone is approved
  IF v_milestone_status != 'approved'::milestone_status THEN
    RAISE EXCEPTION 'Milestone must be approved before releasing funds';
  END IF;
  
  -- Find escrow hold
  SELECT id INTO v_escrow_id
  FROM escrow_holds
  WHERE milestone_id = p_milestone_id
  AND status = 'held';
  
  IF v_escrow_id IS NULL THEN
    RAISE EXCEPTION 'No escrow hold found for milestone';
  END IF;
  
  -- Release funds
  UPDATE escrow_holds
  SET 
    status = 'released',
    released_at = now(),
    released_to = v_contractor_id
  WHERE id = v_escrow_id;
  
  -- Update milestone
  UPDATE milestones
  SET 
    status = 'paid'::milestone_status,
    paid_at = now()
  WHERE id = p_milestone_id;
  
  -- Log audit
  PERFORM log_audit(
    'escrow_hold',
    v_escrow_id,
    'funds_released',
    NULL,
    jsonb_build_object(
      'milestone_id', p_milestone_id,
      'released_to', v_contractor_id
    )
  );
  
  RETURN v_escrow_id;
END;
$$;

-- 7. Fund Next Milestone
CREATE OR REPLACE FUNCTION fund_next_milestone(
  p_transaction_id uuid,
  p_payment_intent_id text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_owner_id uuid;
  v_next_milestone_id uuid;
  v_next_milestone_amount decimal;
  v_escrow_id uuid;
BEGIN
  -- Validate caller is the owner
  SELECT owner_id INTO v_owner_id
  FROM transactions
  WHERE id = p_transaction_id;
  
  IF v_owner_id != auth.uid() THEN
    RAISE EXCEPTION 'Only transaction owner can fund milestones';
  END IF;
  
  -- Get next pending milestone
  SELECT id, amount INTO v_next_milestone_id, v_next_milestone_amount
  FROM milestones
  WHERE transaction_id = p_transaction_id
  AND status = 'pending'::milestone_status
  ORDER BY order_index
  LIMIT 1;
  
  IF v_next_milestone_id IS NULL THEN
    RAISE EXCEPTION 'No pending milestones found';
  END IF;
  
  -- Create escrow hold
  INSERT INTO escrow_holds (
    transaction_id,
    milestone_id,
    amount,
    platform_fee,
    net_amount,
    status,
    payment_intent_id
  ) VALUES (
    p_transaction_id,
    v_next_milestone_id,
    v_next_milestone_amount,
    0,
    v_next_milestone_amount,
    'held',
    p_payment_intent_id
  )
  RETURNING id INTO v_escrow_id;
  
  -- Update milestone to in_progress
  UPDATE milestones
  SET status = 'in_progress'::milestone_status
  WHERE id = v_next_milestone_id;
  
  -- Log audit
  PERFORM log_audit(
    'milestone',
    v_next_milestone_id,
    'funded',
    NULL,
    jsonb_build_object(
      'amount', v_next_milestone_amount,
      'escrow_id', v_escrow_id,
      'payment_intent_id', p_payment_intent_id
    )
  );
  
  RETURN v_escrow_id;
END;
$$;

-- 8. Generate Approval Token
CREATE OR REPLACE FUNCTION generate_approval_token(
  p_milestone_id uuid,
  p_expires_in_days int DEFAULT 7
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_transaction_id uuid;
  v_owner_id uuid;
  v_token text;
  v_expires_at timestamptz;
BEGIN
  -- Validate caller is the owner
  SELECT m.transaction_id, t.owner_id
  INTO v_transaction_id, v_owner_id
  FROM milestones m
  JOIN transactions t ON t.id = m.transaction_id
  WHERE m.id = p_milestone_id;
  
  IF v_owner_id != auth.uid() THEN
    RAISE EXCEPTION 'Only project owner can generate approval token';
  END IF;
  
  -- Generate secure random token
  v_token := encode(gen_random_bytes(32), 'base64');
  v_token := replace(replace(replace(v_token, '/', '_'), '+', '-'), '=', '');
  
  v_expires_at := now() + (p_expires_in_days || ' days')::interval;
  
  -- Create approval record
  INSERT INTO milestone_approvals (
    milestone_id,
    approver_id,
    approval_token,
    status,
    expires_at
  ) VALUES (
    p_milestone_id,
    v_owner_id,
    v_token,
    'pending',
    v_expires_at
  );
  
  RETURN v_token;
END;
$$;

-- 9. Approve by Token (One-Click)
CREATE OR REPLACE FUNCTION approve_milestone_by_token(
  p_token text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_approval_id uuid;
  v_milestone_id uuid;
  v_approval_status text;
  v_expires_at timestamptz;
BEGIN
  -- Find approval record
  SELECT id, milestone_id, status, expires_at
  INTO v_approval_id, v_milestone_id, v_approval_status, v_expires_at
  FROM milestone_approvals
  WHERE approval_token = p_token;
  
  IF v_approval_id IS NULL THEN
    RAISE EXCEPTION 'Invalid approval token';
  END IF;
  
  -- Check if already used
  IF v_approval_status != 'pending' THEN
    RAISE EXCEPTION 'Token already used';
  END IF;
  
  -- Check if expired
  IF v_expires_at < now() THEN
    UPDATE milestone_approvals
    SET status = 'expired'
    WHERE id = v_approval_id;
    
    RAISE EXCEPTION 'Token expired';
  END IF;
  
  -- Approve milestone
  PERFORM approve_milestone(v_milestone_id, 'Approved via one-click token');
  
  -- Mark token as used
  UPDATE milestone_approvals
  SET 
    status = 'approved',
    approved_at = now(),
    approval_type = 'one_click'
  WHERE id = v_approval_id;
  
  RETURN true;
END;
$$;
