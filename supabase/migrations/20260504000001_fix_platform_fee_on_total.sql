/*
  # Fix platform fee calculation

  Platform fee should be 10% of the TOTAL project value (p_total_amount),
  not 10% of the first milestone (p_first_amount).

  Example: $50,000 project split into two $25,000 milestones →
    fee = $5,000 (10% of $50,000), collected at first payment.
*/

DROP FUNCTION IF EXISTS activate_project_after_payment(
  uuid, uuid, uuid, uuid, numeric, numeric, text, text, text, jsonb
);

CREATE OR REPLACE FUNCTION activate_project_after_payment(
  p_project_id       uuid,
  p_bid_id           uuid,
  p_owner_id         uuid,
  p_contractor_id    uuid,
  p_total_amount     numeric,
  p_first_amount     numeric,
  p_mock_tx_id       text,
  p_contractor_name  text,
  p_contractor_phone text,
  p_milestones       jsonb
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
  IF auth.uid() IS DISTINCT FROM p_owner_id THEN
    RAISE EXCEPTION 'Not authorized: caller is not the project owner';
  END IF;

  -- Fee is 10% of the TOTAL project value, collected at first payment
  v_platform_fee := ROUND(p_total_amount * 0.10, 2);

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

  UPDATE projects
  SET
    selected_contractor_id = p_contractor_id,
    status = 'in_progress'::project_status
  WHERE id = p_project_id
    AND owner_id = p_owner_id;

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

  INSERT INTO conversations (project_id, owner_id, contractor_id)
  VALUES (p_project_id, p_owner_id, p_contractor_id)
  ON CONFLICT (project_id, contractor_id) DO UPDATE
    SET last_message_at = now()
  RETURNING id INTO v_conv_id;

  INSERT INTO messages (conversation_id, sender_id, content)
  VALUES (
    v_conv_id,
    p_owner_id,
    '✅ Payment received! Your project is now active. You can now communicate directly with ' || p_contractor_name || '.'
  );

  INSERT INTO notifications (user_id, type, title, message, metadata)
  VALUES (
    p_contractor_id,
    'payment_received',
    'Project Activated',
    'The owner has made the first payment. Your project is now active.',
    jsonb_build_object(
      'project_id',      p_project_id,
      'conversation_id', v_conv_id
    )
  );

  RETURN jsonb_build_object('conversation_id', v_conv_id);
END;
$$;
