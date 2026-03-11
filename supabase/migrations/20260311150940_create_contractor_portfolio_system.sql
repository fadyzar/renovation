/*
  # Contractor Portfolio System

  ## New Tables

  ### `portfolio_projects`
  - Showcase completed projects
  - Client testimonials
  - Before/after photos

  ### `portfolio_images`
  - Portfolio project images
  - Before/during/after types

  ## Security
  - RLS enabled
  - Contractors manage own portfolios
  - Public viewing
*/

-- Portfolio projects
CREATE TABLE IF NOT EXISTS portfolio_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contractor_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text NOT NULL,
  project_type text NOT NULL,
  completion_date date,
  client_name text,
  client_testimonial text,
  budget_range text,
  duration_weeks integer,
  is_featured boolean DEFAULT false,
  display_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Portfolio images
CREATE TABLE IF NOT EXISTS portfolio_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_project_id uuid NOT NULL REFERENCES portfolio_projects(id) ON DELETE CASCADE,
  image_url text NOT NULL,
  caption text,
  image_type text CHECK (image_type IN ('before', 'during', 'after')) DEFAULT 'after',
  display_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_portfolio_contractor ON portfolio_projects(contractor_id);
CREATE INDEX IF NOT EXISTS idx_portfolio_featured ON portfolio_projects(is_featured);
CREATE INDEX IF NOT EXISTS idx_portfolio_imgs ON portfolio_images(portfolio_project_id);

-- Enable RLS
ALTER TABLE portfolio_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE portfolio_images ENABLE ROW LEVEL SECURITY;

-- Portfolio projects policies
CREATE POLICY "View portfolios"
  ON portfolio_projects FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Create portfolio"
  ON portfolio_projects FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = contractor_id);

CREATE POLICY "Update portfolio"
  ON portfolio_projects FOR UPDATE
  TO authenticated
  USING (auth.uid() = contractor_id);

CREATE POLICY "Delete portfolio"
  ON portfolio_projects FOR DELETE
  TO authenticated
  USING (auth.uid() = contractor_id);

-- Portfolio images policies
CREATE POLICY "View portfolio imgs"
  ON portfolio_images FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Manage portfolio imgs"
  ON portfolio_images FOR ALL
  TO authenticated
  USING (
    portfolio_project_id IN (
      SELECT id FROM portfolio_projects WHERE contractor_id = auth.uid()
    )
  );
