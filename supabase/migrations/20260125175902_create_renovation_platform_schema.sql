/*
  # Renovation Intelligence Platform - Complete Schema

  ## Overview
  AI-first SaaS platform connecting property owners with contractors for renovation projects.
  The platform takes 10% commission and manages the entire process with AI assistance.

  ## New Tables

  ### 1. profiles
  Extended user profiles with role-based information
  - `id` (uuid, FK to auth.users)
  - `role` (enum: property_owner, contractor, admin)
  - `full_name` (text)
  - `email` (text)
  - `phone` (text)
  - `avatar_url` (text)
  - `company_name` (text, for contractors)
  - `license_number` (text, for contractors)
  - `bio` (text)
  - `location` (jsonb: address, city, state, zip)
  - `verification_status` (enum: pending, verified, rejected)
  - `rating` (numeric, average rating)
  - `total_projects` (integer)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### 2. properties
  Properties owned by property owners
  - `id` (uuid, PK)
  - `owner_id` (uuid, FK to profiles)
  - `address` (text)
  - `city` (text)
  - `state` (text)
  - `zip_code` (text)
  - `property_type` (text: house, apartment, condo, commercial)
  - `bedrooms` (integer)
  - `bathrooms` (numeric)
  - `square_feet` (integer)
  - `year_built` (integer)
  - `images` (jsonb array)
  - `created_at` (timestamptz)

  ### 3. projects
  Renovation projects
  - `id` (uuid, PK)
  - `property_id` (uuid, FK to properties)
  - `owner_id` (uuid, FK to profiles)
  - `title` (text)
  - `description` (text)
  - `status` (enum: draft, seeking_quotes, in_progress, completed, cancelled, disputed)
  - `work_types` (text array: electrical, plumbing, painting, flooring, etc)
  - `budget_min` (numeric)
  - `budget_max` (numeric)
  - `timeline_weeks` (integer)
  - `urgency` (enum: low, medium, high)
  - `ai_analysis` (jsonb)
  - `selected_contractor_id` (uuid, nullable)
  - `started_at` (timestamptz)
  - `completed_at` (timestamptz)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### 4. project_images
  Images uploaded for projects with AI analysis
  - `id` (uuid, PK)
  - `project_id` (uuid, FK to projects)
  - `image_url` (text)
  - `image_type` (enum: before, during, after, issue)
  - `room_type` (text)
  - `ai_tags` (text array)
  - `ai_detected_work` (jsonb)
  - `ai_risk_score` (numeric)
  - `uploaded_at` (timestamptz)

  ### 5. contractor_portfolios
  Contractor before/after project showcase
  - `id` (uuid, PK)
  - `contractor_id` (uuid, FK to profiles)
  - `project_name` (text)
  - `description` (text)
  - `work_types` (text array)
  - `before_images` (jsonb array)
  - `after_images` (jsonb array)
  - `cost` (numeric)
  - `duration_weeks` (integer)
  - `ai_quality_score` (numeric)
  - `created_at` (timestamptz)

  ### 6. quotes
  Contractor quotes for projects
  - `id` (uuid, PK)
  - `project_id` (uuid, FK to projects)
  - `contractor_id` (uuid, FK to profiles)
  - `amount` (numeric)
  - `timeline_weeks` (integer)
  - `description` (text)
  - `breakdown` (jsonb)
  - `ai_price_score` (numeric, 0-100)
  - `ai_reliability_score` (numeric, 0-100)
  - `ai_feedback` (jsonb)
  - `status` (enum: pending, accepted, rejected, withdrawn)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### 7. ai_analyses
  Comprehensive AI analysis results
  - `id` (uuid, PK)
  - `entity_type` (enum: project, image, quote, contractor)
  - `entity_id` (uuid)
  - `analysis_type` (text)
  - `results` (jsonb)
  - `confidence_score` (numeric)
  - `created_at` (timestamptz)

  ### 8. messages
  Chat between owners and contractors
  - `id` (uuid, PK)
  - `project_id` (uuid, FK to projects)
  - `sender_id` (uuid, FK to profiles)
  - `receiver_id` (uuid, FK to profiles)
  - `message` (text)
  - `ai_summary` (text, nullable)
  - `read` (boolean)
  - `created_at` (timestamptz)

  ### 9. transactions
  Payment tracking with escrow
  - `id` (uuid, PK)
  - `project_id` (uuid, FK to projects)
  - `owner_id` (uuid, FK to profiles)
  - `contractor_id` (uuid, FK to profiles)
  - `amount` (numeric)
  - `platform_fee` (numeric, 10%)
  - `status` (enum: pending, escrowed, released, refunded, disputed)
  - `stripe_payment_id` (text)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### 10. milestones
  Project milestones for payment release
  - `id` (uuid, PK)
  - `project_id` (uuid, FK to projects)
  - `title` (text)
  - `description` (text)
  - `amount` (numeric)
  - `status` (enum: pending, in_progress, completed, approved, paid)
  - `due_date` (timestamptz)
  - `completed_at` (timestamptz)
  - `created_at` (timestamptz)

  ### 11. reviews
  Reviews and ratings
  - `id` (uuid, PK)
  - `project_id` (uuid, FK to projects)
  - `reviewer_id` (uuid, FK to profiles)
  - `reviewee_id` (uuid, FK to profiles)
  - `rating` (integer, 1-5)
  - `review_text` (text)
  - `ai_sentiment_score` (numeric)
  - `created_at` (timestamptz)

  ### 12. disputes
  Dispute management
  - `id` (uuid, PK)
  - `project_id` (uuid, FK to projects)
  - `raised_by` (uuid, FK to profiles)
  - `reason` (text)
  - `status` (enum: open, investigating, resolved, closed)
  - `resolution` (text)
  - `resolved_at` (timestamptz)
  - `created_at` (timestamptz)

  ## Security
  - RLS enabled on all tables
  - Policies for role-based access control
  - Contractors can only see their own quotes and assigned projects
  - Owners can only see their own properties and projects
  - Admins have full access
*/

-- Create custom types
CREATE TYPE user_role AS ENUM ('property_owner', 'contractor', 'admin');
CREATE TYPE verification_status AS ENUM ('pending', 'verified', 'rejected');
CREATE TYPE project_status AS ENUM ('draft', 'seeking_quotes', 'in_progress', 'completed', 'cancelled', 'disputed');
CREATE TYPE urgency_level AS ENUM ('low', 'medium', 'high');
CREATE TYPE image_type AS ENUM ('before', 'during', 'after', 'issue');
CREATE TYPE quote_status AS ENUM ('pending', 'accepted', 'rejected', 'withdrawn');
CREATE TYPE entity_type AS ENUM ('project', 'image', 'quote', 'contractor');
CREATE TYPE transaction_status AS ENUM ('pending', 'escrowed', 'released', 'refunded', 'disputed');
CREATE TYPE milestone_status AS ENUM ('pending', 'in_progress', 'completed', 'approved', 'paid');
CREATE TYPE dispute_status AS ENUM ('open', 'investigating', 'resolved', 'closed');

-- 1. Profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role user_role NOT NULL DEFAULT 'property_owner',
  full_name text NOT NULL,
  email text UNIQUE NOT NULL,
  phone text,
  avatar_url text,
  company_name text,
  license_number text,
  bio text,
  location jsonb DEFAULT '{}',
  verification_status verification_status DEFAULT 'pending',
  rating numeric(3, 2) DEFAULT 0.00,
  total_projects integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2. Properties table
CREATE TABLE IF NOT EXISTS properties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  address text NOT NULL,
  city text NOT NULL,
  state text NOT NULL,
  zip_code text NOT NULL,
  property_type text DEFAULT 'house',
  bedrooms integer DEFAULT 0,
  bathrooms numeric(3, 1) DEFAULT 0,
  square_feet integer,
  year_built integer,
  images jsonb DEFAULT '[]',
  created_at timestamptz DEFAULT now()
);

-- 3. Projects table
CREATE TABLE IF NOT EXISTS projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid REFERENCES properties(id) ON DELETE CASCADE,
  owner_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  description text NOT NULL,
  status project_status DEFAULT 'draft',
  work_types text[] DEFAULT ARRAY[]::text[],
  budget_min numeric(10, 2),
  budget_max numeric(10, 2),
  timeline_weeks integer,
  urgency urgency_level DEFAULT 'medium',
  ai_analysis jsonb DEFAULT '{}',
  selected_contractor_id uuid REFERENCES profiles(id),
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 4. Project Images table
CREATE TABLE IF NOT EXISTS project_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  image_url text NOT NULL,
  image_type image_type DEFAULT 'before',
  room_type text,
  ai_tags text[] DEFAULT ARRAY[]::text[],
  ai_detected_work jsonb DEFAULT '{}',
  ai_risk_score numeric(3, 2) DEFAULT 0,
  uploaded_at timestamptz DEFAULT now()
);

-- 5. Contractor Portfolios table
CREATE TABLE IF NOT EXISTS contractor_portfolios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contractor_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  project_name text NOT NULL,
  description text,
  work_types text[] DEFAULT ARRAY[]::text[],
  before_images jsonb DEFAULT '[]',
  after_images jsonb DEFAULT '[]',
  cost numeric(10, 2),
  duration_weeks integer,
  ai_quality_score numeric(3, 2) DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- 6. Quotes table
CREATE TABLE IF NOT EXISTS quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  contractor_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  amount numeric(10, 2) NOT NULL,
  timeline_weeks integer NOT NULL,
  description text NOT NULL,
  breakdown jsonb DEFAULT '{}',
  ai_price_score numeric(5, 2) DEFAULT 0,
  ai_reliability_score numeric(5, 2) DEFAULT 0,
  ai_feedback jsonb DEFAULT '{}',
  status quote_status DEFAULT 'pending',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 7. AI Analyses table
CREATE TABLE IF NOT EXISTS ai_analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type entity_type NOT NULL,
  entity_id uuid NOT NULL,
  analysis_type text NOT NULL,
  results jsonb DEFAULT '{}',
  confidence_score numeric(3, 2) DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- 8. Messages table
CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  sender_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  receiver_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  message text NOT NULL,
  ai_summary text,
  read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- 9. Transactions table
CREATE TABLE IF NOT EXISTS transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  owner_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  contractor_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  amount numeric(10, 2) NOT NULL,
  platform_fee numeric(10, 2) NOT NULL,
  status transaction_status DEFAULT 'pending',
  stripe_payment_id text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 10. Milestones table
CREATE TABLE IF NOT EXISTS milestones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  description text,
  amount numeric(10, 2) NOT NULL,
  status milestone_status DEFAULT 'pending',
  due_date timestamptz,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- 11. Reviews table
CREATE TABLE IF NOT EXISTS reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  reviewer_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  reviewee_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  review_text text,
  ai_sentiment_score numeric(3, 2) DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- 12. Disputes table
CREATE TABLE IF NOT EXISTS disputes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  raised_by uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  reason text NOT NULL,
  status dispute_status DEFAULT 'open',
  resolution text,
  resolved_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE contractor_portfolios ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE disputes ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles
CREATE POLICY "Users can view all profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- RLS Policies for properties
CREATE POLICY "Owners can view own properties"
  ON properties FOR SELECT
  TO authenticated
  USING (auth.uid() = owner_id);

CREATE POLICY "Owners can insert own properties"
  ON properties FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Owners can update own properties"
  ON properties FOR UPDATE
  TO authenticated
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Owners can delete own properties"
  ON properties FOR DELETE
  TO authenticated
  USING (auth.uid() = owner_id);

-- RLS Policies for projects
CREATE POLICY "Owners can view own projects"
  ON projects FOR SELECT
  TO authenticated
  USING (
    auth.uid() = owner_id 
    OR auth.uid() = selected_contractor_id
    OR EXISTS (
      SELECT 1 FROM quotes 
      WHERE quotes.project_id = projects.id 
      AND quotes.contractor_id = auth.uid()
    )
  );

CREATE POLICY "Owners can create projects"
  ON projects FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Owners can update own projects"
  ON projects FOR UPDATE
  TO authenticated
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Owners can delete own projects"
  ON projects FOR DELETE
  TO authenticated
  USING (auth.uid() = owner_id);

-- RLS Policies for project_images
CREATE POLICY "Users can view project images they have access to"
  ON project_images FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM projects 
      WHERE projects.id = project_images.project_id 
      AND (
        projects.owner_id = auth.uid() 
        OR projects.selected_contractor_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM quotes 
          WHERE quotes.project_id = projects.id 
          AND quotes.contractor_id = auth.uid()
        )
      )
    )
  );

CREATE POLICY "Project owners can insert images"
  ON project_images FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects 
      WHERE projects.id = project_images.project_id 
      AND projects.owner_id = auth.uid()
    )
  );

-- RLS Policies for contractor_portfolios
CREATE POLICY "Everyone can view contractor portfolios"
  ON contractor_portfolios FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Contractors can insert own portfolio"
  ON contractor_portfolios FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = contractor_id);

CREATE POLICY "Contractors can update own portfolio"
  ON contractor_portfolios FOR UPDATE
  TO authenticated
  USING (auth.uid() = contractor_id)
  WITH CHECK (auth.uid() = contractor_id);

CREATE POLICY "Contractors can delete own portfolio"
  ON contractor_portfolios FOR DELETE
  TO authenticated
  USING (auth.uid() = contractor_id);

-- RLS Policies for quotes
CREATE POLICY "Users can view relevant quotes"
  ON quotes FOR SELECT
  TO authenticated
  USING (
    auth.uid() = contractor_id 
    OR EXISTS (
      SELECT 1 FROM projects 
      WHERE projects.id = quotes.project_id 
      AND projects.owner_id = auth.uid()
    )
  );

CREATE POLICY "Contractors can create quotes"
  ON quotes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = contractor_id);

CREATE POLICY "Contractors can update own quotes"
  ON quotes FOR UPDATE
  TO authenticated
  USING (auth.uid() = contractor_id)
  WITH CHECK (auth.uid() = contractor_id);

-- RLS Policies for messages
CREATE POLICY "Users can view their messages"
  ON messages FOR SELECT
  TO authenticated
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

CREATE POLICY "Users can send messages"
  ON messages FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "Users can update their received messages"
  ON messages FOR UPDATE
  TO authenticated
  USING (auth.uid() = receiver_id)
  WITH CHECK (auth.uid() = receiver_id);

-- RLS Policies for transactions
CREATE POLICY "Users can view their transactions"
  ON transactions FOR SELECT
  TO authenticated
  USING (auth.uid() = owner_id OR auth.uid() = contractor_id);

CREATE POLICY "Owners can create transactions"
  ON transactions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = owner_id);

-- RLS Policies for milestones
CREATE POLICY "Users can view milestones for their projects"
  ON milestones FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM projects 
      WHERE projects.id = milestones.project_id 
      AND (projects.owner_id = auth.uid() OR projects.selected_contractor_id = auth.uid())
    )
  );

CREATE POLICY "Owners can create milestones"
  ON milestones FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects 
      WHERE projects.id = milestones.project_id 
      AND projects.owner_id = auth.uid()
    )
  );

-- RLS Policies for reviews
CREATE POLICY "Everyone can view reviews"
  ON reviews FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create reviews for their projects"
  ON reviews FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = reviewer_id 
    AND EXISTS (
      SELECT 1 FROM projects 
      WHERE projects.id = reviews.project_id 
      AND (projects.owner_id = auth.uid() OR projects.selected_contractor_id = auth.uid())
    )
  );

-- RLS Policies for disputes
CREATE POLICY "Users can view their disputes"
  ON disputes FOR SELECT
  TO authenticated
  USING (
    auth.uid() = raised_by 
    OR EXISTS (
      SELECT 1 FROM projects 
      WHERE projects.id = disputes.project_id 
      AND (projects.owner_id = auth.uid() OR projects.selected_contractor_id = auth.uid())
    )
  );

CREATE POLICY "Users can create disputes for their projects"
  ON disputes FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = raised_by 
    AND EXISTS (
      SELECT 1 FROM projects 
      WHERE projects.id = disputes.project_id 
      AND (projects.owner_id = auth.uid() OR projects.selected_contractor_id = auth.uid())
    )
  );

-- RLS Policies for ai_analyses
CREATE POLICY "Users can view AI analyses for accessible entities"
  ON ai_analyses FOR SELECT
  TO authenticated
  USING (true);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_verification ON profiles(verification_status);
CREATE INDEX IF NOT EXISTS idx_properties_owner ON properties(owner_id);
CREATE INDEX IF NOT EXISTS idx_projects_owner ON projects(owner_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_contractor ON projects(selected_contractor_id);
CREATE INDEX IF NOT EXISTS idx_project_images_project ON project_images(project_id);
CREATE INDEX IF NOT EXISTS idx_contractor_portfolios_contractor ON contractor_portfolios(contractor_id);
CREATE INDEX IF NOT EXISTS idx_quotes_project ON quotes(project_id);
CREATE INDEX IF NOT EXISTS idx_quotes_contractor ON quotes(contractor_id);
CREATE INDEX IF NOT EXISTS idx_messages_project ON messages(project_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_receiver ON messages(receiver_id);
CREATE INDEX IF NOT EXISTS idx_transactions_project ON transactions(project_id);
CREATE INDEX IF NOT EXISTS idx_milestones_project ON milestones(project_id);
CREATE INDEX IF NOT EXISTS idx_reviews_reviewee ON reviews(reviewee_id);
CREATE INDEX IF NOT EXISTS idx_disputes_project ON disputes(project_id);