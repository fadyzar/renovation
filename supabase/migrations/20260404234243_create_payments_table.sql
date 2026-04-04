/*
  # Create Payments Table for Deposit System
  
  Creates the missing `payments` table that the deposit flow depends on.
  
  ## Tables Created
  - `payments` - Stores deposit and milestone payments
    - `id` (uuid, PK)
    - `project_id` (uuid, FK → projects)
    - `bid_id` (uuid, FK → bids)  
    - `owner_id` (uuid, FK → profiles)
    - `contractor_id` (uuid, FK → profiles)
    - `total_amount` (numeric)
    - `is_deposit` (boolean)
    - `deposit_percentage` (numeric)
    - `status` (text) - 'escrowed', 'released', 'refunded'
    - `mock_transaction_id` (text) - for demo mode
    - `paid_at` (timestamptz)
    - `created_at` (timestamptz)
    
  ## Security
  - Enable RLS
  - Owners can view their own payments
  - Contractors can view their own payments  
  - Insert allowed for authenticated contractors
  
  ## Constraints
  - UNIQUE(project_id, bid_id) - prevents duplicate deposits for same bid
  - CHECK status in ('escrowed', 'released', 'refunded')
*/

-- Create payments table
CREATE TABLE IF NOT EXISTS payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  bid_id uuid NOT NULL REFERENCES bids(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  contractor_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  total_amount numeric NOT NULL CHECK (total_amount > 0),
  is_deposit boolean NOT NULL DEFAULT true,
  deposit_percentage numeric DEFAULT 10,
  status text NOT NULL DEFAULT 'escrowed' CHECK (status IN ('escrowed', 'released', 'refunded')),
  mock_transaction_id text,
  paid_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  
  -- Prevent duplicate deposits for same project+bid
  UNIQUE(project_id, bid_id)
);

-- Enable RLS
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- Owners can view payments for their projects
CREATE POLICY "Owners can view their payments"
  ON payments FOR SELECT
  TO authenticated
  USING (auth.uid() = owner_id);

-- Contractors can view their payments
CREATE POLICY "Contractors can view their payments"
  ON payments FOR SELECT
  TO authenticated
  USING (auth.uid() = contractor_id);

-- Contractors can create payments (deposit)
CREATE POLICY "Contractors can create payments"
  ON payments FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = contractor_id);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_payments_project_id ON payments(project_id);
CREATE INDEX IF NOT EXISTS idx_payments_bid_id ON payments(bid_id);
CREATE INDEX IF NOT EXISTS idx_payments_contractor_id ON payments(contractor_id);
CREATE INDEX IF NOT EXISTS idx_payments_owner_id ON payments(owner_id);
