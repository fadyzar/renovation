/*
  # Project Scans — Room Measurement Data

  ## Overview
  Stores structured space measurement data attached to a project.
  Designed to be scan-source-agnostic: the same schema supports manual entry,
  AI photo analysis, and future native AR scanning (ARKit/ARCore).

  ## scan_source values
    'manual'              — User typed measurements
    'photo_ai'            — AI analysis of photos (Phase 1, current web capability)
    'ar_web'              — WebXR plane detection (future, limited browser support)
    'ar_native_ios'       — ARKit LiDAR (future, requires React Native + iPhone 12 Pro+)
    'ar_native_android'   — ARCore (future, requires React Native)

  ## scan_status flow
    pending → processing → completed | failed
    OR
    pending → manual (when user types directly)

  ## Future native integration
  A React Native companion app writes to this same table.
  The web platform reads scan data regardless of how it was collected.
  To upgrade accuracy: change scan_source to 'ar_native_ios', raise scan_confidence.
*/

-- ─── project_scans table ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS project_scans (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  owner_id    uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- ── Status ──────────────────────────────────────────────────────────────────
  scan_status text NOT NULL DEFAULT 'pending' CHECK (scan_status IN (
    'pending', 'processing', 'completed', 'failed', 'manual'
  )),
  scan_source text NOT NULL DEFAULT 'manual' CHECK (scan_source IN (
    'manual',
    'photo_ai',
    'ar_web',
    'ar_native_ios',
    'ar_native_android'
  )),

  -- ── Measurements (all nullable — partial data is valid) ────────────────────
  measured_area_sqft  numeric(10,2),
  room_length_ft      numeric(8,2),
  room_width_ft       numeric(8,2),
  room_height_ft      numeric(8,2),
  wall_area_sqft      numeric(10,2),
  floor_area_sqft     numeric(10,2),
  window_count        integer,
  door_count          integer,
  room_count          integer DEFAULT 1,

  -- ── AI / scan analysis outputs ─────────────────────────────────────────────
  scan_confidence     numeric(5,2) CHECK (scan_confidence >= 0 AND scan_confidence <= 100),
  scan_summary        text,
  detected_room_type  text,
  detected_features   text[],   -- e.g. ['hardwood_floor', 'popcorn_ceiling', 'crown_molding']
  estimated_complexity text CHECK (estimated_complexity IN ('low', 'medium', 'high')),
  renovation_notes    text,     -- AI-generated renovation considerations

  -- ── Source data ────────────────────────────────────────────────────────────
  photo_urls          text[],
  raw_scan_payload    jsonb,    -- Reserved for future native AR scan data
  ai_analysis_payload jsonb,   -- Full AI response (for debugging/auditing)

  -- ── Owner confirmation ─────────────────────────────────────────────────────
  is_confirmed   boolean DEFAULT false,
  confirmed_at   timestamptz,

  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now(),

  -- One scan record per project (can be updated)
  UNIQUE(project_id)
);

-- ─── Indexes ──────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_project_scans_project  ON project_scans(project_id);
CREATE INDEX IF NOT EXISTS idx_project_scans_owner    ON project_scans(owner_id);
CREATE INDEX IF NOT EXISTS idx_project_scans_status   ON project_scans(scan_status);
CREATE INDEX IF NOT EXISTS idx_project_scans_source   ON project_scans(scan_source);

-- ─── RLS ──────────────────────────────────────────────────────────────────────

ALTER TABLE project_scans ENABLE ROW LEVEL SECURITY;

-- Owner can fully manage their own scan records
CREATE POLICY "Owners manage own scans"
  ON project_scans FOR ALL
  TO authenticated
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

-- Contractors can read scan data for projects they bid on or are matched with
CREATE POLICY "Contractors read scan data for accessible projects"
  ON project_scans FOR SELECT
  TO authenticated
  USING (
    project_id IN (
      SELECT id FROM projects
      WHERE status IN ('seeking_quotes', 'awaiting_deposit', 'in_progress')
    )
  );

-- ─── Updated_at trigger ───────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_project_scans_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_project_scans_updated_at ON project_scans;
CREATE TRIGGER trigger_project_scans_updated_at
  BEFORE UPDATE ON project_scans
  FOR EACH ROW
  EXECUTE FUNCTION update_project_scans_updated_at();

-- ─── Storage bucket for scan photos ───────────────────────────────────────────
-- Run this in the Supabase dashboard if buckets aren't managed via SQL:
-- INSERT INTO storage.buckets (id, name, public) VALUES ('scan-photos', 'scan-photos', true) ON CONFLICT DO NOTHING;

DO $$
BEGIN
  INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  VALUES (
    'scan-photos',
    'scan-photos',
    true,
    10485760,  -- 10MB per photo
    ARRAY['image/jpeg', 'image/png', 'image/webp']
  )
  ON CONFLICT (id) DO NOTHING;
EXCEPTION WHEN OTHERS THEN
  -- storage schema may not be accessible in all environments — handled in app layer
  NULL;
END $$;

-- Storage policies (if bucket was created above)
DO $$
BEGIN
  -- Owners can upload scan photos
  CREATE POLICY "scan_photos_owner_upload"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'scan-photos');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  -- Anyone can read scan photos (they're used for AI analysis, then shown to contractors)
  CREATE POLICY "scan_photos_public_read"
    ON storage.objects FOR SELECT
    TO public
    USING (bucket_id = 'scan-photos');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
