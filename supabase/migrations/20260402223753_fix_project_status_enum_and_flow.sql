/*
  # Fix Project Status Enum and Flow

  1. Changes
    - Add 'awaiting_deposit' to project_status enum
    - This status is used when owner accepts a bid and contractor needs to pay deposit
    - Flow: seeking_quotes -> awaiting_deposit -> in_progress

  2. Notes
    - This fixes the issue where AcceptOffer tries to set status='awaiting_deposit'
    - Contractor must pay 10% deposit before project moves to in_progress
*/

-- Add 'awaiting_deposit' to the project_status enum
ALTER TYPE project_status ADD VALUE IF NOT EXISTS 'awaiting_deposit';