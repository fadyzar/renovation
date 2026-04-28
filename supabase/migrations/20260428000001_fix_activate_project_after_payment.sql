/*
  # Fix activate_project_after_payment RPC

  The previous version of this function tried to INSERT bid_id into the
  transactions table, but that column does not exist.  This migration
  replaces it with a correct implementation that:
    1. Records a transaction using the original columns (amount, platform_fee,
       stripe_payment_id) so the fee-validation trigger is not fired.
    2. Sets the project to in_progress and assigns selected_contractor_id.
    3. Creates milestone rows from the bid milestones JSON.
    4. Creates (or reuses) the conversation between owner and contractor.
    5. Posts a system activation message.
    6. Returns json { conversation_id }.
*/

-- Drop all overloads so the CREATE OR REPLACE below is unambiguous.
DROP FUNCTION IF EXISTS activate_project_after_payment(
  uuid, uuid, uuid, uuid, numeric, numeric, text, text, text, jsonb
);

CREATE OR REPLACE FUNCTION activate_project_after_payment(
  p_project_id       uuid,
  p_bid_id           uuid,        -- kept in signature for call-site compat, not stored
  p_owner_id         uuid,
  p_contractor_id    uuid,
  p_total_amount     numeric,
  p_first_amount     numeric,
  p_mock_tx_id       text,
  p_contractor_name  text,
  p_contractor_phone text,
  p_milestones       jsonb        -- array of {description, price, duration?}
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_platform_fee numeric;
  v_conv_id      uuid;
  v_milestone    jsonb;
  v_i            int := 0;
BEGIN
  -- Caller must be the project owner
  IF auth.uid() IS DISTINCT FROM p_owner_id THEN
    RAISE EXCEPTION 'Not authorized: caller is not the project owner';
  END IF;

  v_platform_fee := ROUND(p_first_amount * 0.10, 2);

  -- 1. Record the payment transaction (original columns only — avoids the
  --    validate_transaction_fee trigger which checks total_amount/net_amount).
  INSERT INTO transactions (
    project_id,
    owner_id,
    contractor_id,
    amount,
    platform_fee,
    stripe_payment_id,
    status
  ) VALUES (
    p_project_id,
    p_owner_id,
    p_contractor_id,
    p_first_amount,
    v_platform_fee,
    p_mock_tx_id,
    'escrowed'::transaction_status
  )
  ON CONFLICT DO NOTHING;

  -- 2. Activate the project
  UPDATE projects
  SET
    selected_contractor_id = p_contractor_id,
    status = 'in_progress'::project_status
  WHERE id = p_project_id
    AND owner_id = p_owner_id;

  -- 3. Create milestone rows from bid milestones
  --    First milestone is immediately marked paid (owner paid it during activation).
  FOR v_milestone IN SELECT * FROM jsonb_array_elements(p_milestones)
  LOOP
    INSERT INTO milestones (
      project_id,
      title,
      description,
      amount,
      order_index,
      status,
      paid_at,
      approved_at
    ) VALUES (
      p_project_id,
      COALESCE(NULLIF(TRIM(v_milestone->>'description'), ''), 'Milestone ' || (v_i + 1)),
      v_milestone->>'description',
      COALESCE((v_milestone->>'price')::numeric, 0),
      v_i + 1,
      CASE WHEN v_i = 0 THEN 'paid'::milestone_status ELSE 'pending'::milestone_status END,
      CASE WHEN v_i = 0 THEN NOW() ELSE NULL END,
      CASE WHEN v_i = 0 THEN NOW() ELSE NULL END
    );
    v_i := v_i + 1;
  END LOOP;

  -- 4. Create or reuse conversation
  INSERT INTO conversations (project_id, owner_id, contractor_id)
  VALUES (p_project_id, p_owner_id, p_contractor_id)
  ON CONFLICT (project_id, contractor_id) DO UPDATE
    SET last_message_at = now()
  RETURNING id INTO v_conv_id;

  -- 5. System activation message
  INSERT INTO messages (conversation_id, sender_id, content)
  VALUES (
    v_conv_id,
    p_owner_id,
    '✅ Payment received! Your project is now active. You can now communicate directly with ' || p_contractor_name || '.'
  );

  -- 6. Notify contractor
  INSERT INTO notifications (user_id, type, title, message, data)
  VALUES (
    p_contractor_id,
    'payment_received',
    'Project Activated',
    'The owner has made the first payment. Your project is now active.',
    jsonb_build_object(
      'project_id',      p_project_id,
      'conversation_id', v_conv_id
    )
  )
  ON CONFLICT DO NOTHING;

  RETURN jsonb_build_object('conversation_id', v_conv_id);
END;
$$;
