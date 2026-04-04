/*
  # Fix Notifications Table for Deposit Payments
  
  ## Changes
  1. Add 'deposit_paid' to allowed notification types
  2. Ensure metadata column exists (already does via previous migration)
  
  ## Why
  - DepositPaymentModal tries to insert 'deposit_paid' notifications
  - Current constraint blocks this type
*/

-- Drop existing type constraint if exists
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;

-- Add new constraint with deposit_paid included
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check 
  CHECK (type IN (
    'new_bid',
    'bid_accepted', 
    'bid_rejected',
    'new_message',
    'project_update',
    'payment_received',
    'milestone_completed',
    'milestone_approved',
    'deposit_paid'
  ));
