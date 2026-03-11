/*
  # Enhance Reviews System

  ## Changes
  - Add title field for review summary
  - Add contractor response capability
  - Add response date tracking
  - Update RLS policies for contractor responses
  - Add triggers for rating calculation and notifications

  ## Security
  - Contractors can respond to reviews about them
  - Automatic rating updates
*/

-- Add new columns if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'reviews' AND column_name = 'title'
  ) THEN
    ALTER TABLE reviews ADD COLUMN title text DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'reviews' AND column_name = 'contractor_response'
  ) THEN
    ALTER TABLE reviews ADD COLUMN contractor_response text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'reviews' AND column_name = 'response_date'
  ) THEN
    ALTER TABLE reviews ADD COLUMN response_date timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'reviews' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE reviews ADD COLUMN updated_at timestamptz DEFAULT now();
  END IF;
END $$;

-- Add index on reviewee (contractor)
CREATE INDEX IF NOT EXISTS idx_reviews_reviewee ON reviews(reviewee_id);

-- Update RLS policies
DROP POLICY IF EXISTS "Contractors respond to reviews" ON reviews;
CREATE POLICY "Contractors respond to reviews"
  ON reviews FOR UPDATE
  TO authenticated
  USING (auth.uid() = reviewee_id)
  WITH CHECK (auth.uid() = reviewee_id);

-- Function to update contractor rating
CREATE OR REPLACE FUNCTION update_contractor_rating_from_reviews()
RETURNS TRIGGER AS $$
DECLARE
  target_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    target_id := OLD.reviewee_id;
  ELSE
    target_id := NEW.reviewee_id;
  END IF;

  UPDATE profiles
  SET 
    rating = (
      SELECT COALESCE(AVG(rating), 0)
      FROM reviews
      WHERE reviewee_id = target_id
    ),
    updated_at = now()
  WHERE id = target_id;
  
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Triggers for rating updates
DROP TRIGGER IF EXISTS trigger_rating_insert ON reviews;
CREATE TRIGGER trigger_rating_insert
  AFTER INSERT ON reviews
  FOR EACH ROW
  EXECUTE FUNCTION update_contractor_rating_from_reviews();

DROP TRIGGER IF EXISTS trigger_rating_update ON reviews;
CREATE TRIGGER trigger_rating_update
  AFTER UPDATE OF rating ON reviews
  FOR EACH ROW
  EXECUTE FUNCTION update_contractor_rating_from_reviews();

DROP TRIGGER IF EXISTS trigger_rating_delete ON reviews;
CREATE TRIGGER trigger_rating_delete
  AFTER DELETE ON reviews
  FOR EACH ROW
  EXECUTE FUNCTION update_contractor_rating_from_reviews();

-- Function to notify contractor of new review
CREATE OR REPLACE FUNCTION notify_contractor_review()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO notifications (user_id, type, title, message, link, metadata)
  VALUES (
    NEW.reviewee_id,
    'project_update',
    'New Review Received',
    'You received a ' || NEW.rating || '-star review',
    '/profile',
    jsonb_build_object('review_id', NEW.id, 'rating', NEW.rating)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_notify_review ON reviews;
CREATE TRIGGER trigger_notify_review
  AFTER INSERT ON reviews
  FOR EACH ROW
  EXECUTE FUNCTION notify_contractor_review();
