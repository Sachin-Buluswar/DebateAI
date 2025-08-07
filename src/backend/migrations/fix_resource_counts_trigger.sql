-- Fix for missing trigger that updates view/download counts
-- Run this in Supabase SQL Editor to enable automatic count updates

-- First, ensure the function exists
CREATE OR REPLACE FUNCTION update_resource_counts()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.event_type = 'view' THEN
    UPDATE educational_resources 
    SET view_count = view_count + 1,
        updated_at = NOW()
    WHERE id = NEW.resource_id;
  ELSIF NEW.event_type = 'download' THEN
    UPDATE educational_resources 
    SET download_count = download_count + 1,
        updated_at = NOW()
    WHERE id = NEW.resource_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger
DROP TRIGGER IF EXISTS update_resource_counts_trigger ON resource_analytics;
CREATE TRIGGER update_resource_counts_trigger
AFTER INSERT ON resource_analytics
FOR EACH ROW
EXECUTE FUNCTION update_resource_counts();

-- Update existing counts based on analytics already recorded
UPDATE educational_resources er
SET 
  view_count = COALESCE((
    SELECT COUNT(*) 
    FROM resource_analytics ra 
    WHERE ra.resource_id = er.id AND ra.event_type = 'view'
  ), 0),
  download_count = COALESCE((
    SELECT COUNT(*) 
    FROM resource_analytics ra 
    WHERE ra.resource_id = er.id AND ra.event_type = 'download'
  ), 0),
  updated_at = NOW()
WHERE er.id IN (SELECT DISTINCT resource_id FROM resource_analytics);

-- Verify the update worked
SELECT 
  title, 
  view_count, 
  download_count,
  (SELECT COUNT(*) FROM resource_analytics WHERE resource_id = er.id AND event_type = 'view') as actual_views,
  (SELECT COUNT(*) FROM resource_analytics WHERE resource_id = er.id AND event_type = 'download') as actual_downloads
FROM educational_resources er;