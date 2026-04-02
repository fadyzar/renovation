/*
  # Create Bids Table and RLS Policies

  1. New Tables
    - `bids`
      - `id` (uuid, primary key) - Unique bid identifier
      - `project_id` (uuid, FK) - Reference to the project
      - `contractor_id` (uuid, FK) - Reference to the contractor's profile
      - `total_price` (numeric) - Total bid amount
      - `milestones` (jsonb) - Array of milestone objects with description, price, and duration
      - `message` (text) - Contractor's message to project owner
      - `status` (text) - Bid status: submitted, viewed, accepted, rejected
      - `viewed_at` (timestamptz) - When the owner viewed the bid
      - `responded_at` (timestamptz) - When the owner responded
      - `created_at` (timestamptz) - Creation timestamp
      - `updated_at` (timestamptz) - Last update timestamp

  2. Security
    - Enable RLS on `bids` table
    - Contractors can view their own bids
    - Project owners can view bids for their projects
    - Contractors can create bids for seeking_quotes projects
    - Contractors can update their own bids (only when status is 'submitted')
    - Project owners can update bid status and viewed_at

  3. Indexes
    - Index on project_id for faster bid lookups
    - Index on contractor_id for contractor's bid list
    - Index on status for filtering
*/

-- Create bids table
CREATE TABLE IF NOT EXISTS bids (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  contractor_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  total_price numeric NOT NULL CHECK (total_price > 0),
  milestones jsonb NOT NULL DEFAULT '[]'::jsonb,
  message text DEFAULT '',
  status text NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'viewed', 'accepted', 'rejected')),
  viewed_at timestamptz,
  responded_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_bids_project_id ON bids(project_id);
CREATE INDEX IF NOT EXISTS idx_bids_contractor_id ON bids(contractor_id);
CREATE INDEX IF NOT EXISTS idx_bids_status ON bids(status);
CREATE INDEX IF NOT EXISTS idx_bids_created_at ON bids(created_at DESC);

-- Enable RLS
ALTER TABLE bids ENABLE ROW LEVEL SECURITY;

-- Contractors can view their own bids
CREATE POLICY "Contractors can view own bids"
  ON bids FOR SELECT
  TO authenticated
  USING (contractor_id = auth.uid());

-- Project owners can view bids for their projects
CREATE POLICY "Owners can view bids for their projects"
  ON bids FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = bids.project_id
      AND projects.owner_id = auth.uid()
    )
  );

-- Contractors can create bids for seeking_quotes projects
CREATE POLICY "Contractors can create bids"
  ON bids FOR INSERT
  TO authenticated
  WITH CHECK (
    contractor_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = bids.project_id
      AND projects.status = 'seeking_quotes'
    )
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'contractor'
    )
  );

-- Contractors can update their own bids when status is 'submitted'
CREATE POLICY "Contractors can update own submitted bids"
  ON bids FOR UPDATE
  TO authenticated
  USING (
    contractor_id = auth.uid()
    AND status = 'submitted'
  )
  WITH CHECK (
    contractor_id = auth.uid()
    AND status = 'submitted'
  );

-- Project owners can update bid status and viewed_at
CREATE POLICY "Owners can update bid status"
  ON bids FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = bids.project_id
      AND projects.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = bids.project_id
      AND projects.owner_id = auth.uid()
    )
  );

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_bids_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
DROP TRIGGER IF EXISTS update_bids_updated_at_trigger ON bids;
CREATE TRIGGER update_bids_updated_at_trigger
  BEFORE UPDATE ON bids
  FOR EACH ROW
  EXECUTE FUNCTION update_bids_updated_at();