-- Create educational_resources table and related structures
CREATE TABLE IF NOT EXISTS educational_resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  category TEXT NOT NULL CHECK (category IN ('guides', 'lessons', 'slideshows', 'worksheets')),
  file_url TEXT NOT NULL,
  file_type TEXT NOT NULL DEFAULT 'pdf',
  thumbnail_url TEXT,
  authors TEXT[] NOT NULL DEFAULT '{}',
  tags TEXT[] DEFAULT '{}',
  difficulty TEXT CHECK (difficulty IN ('beginner', 'intermediate', 'advanced')),
  duration_minutes INTEGER,
  download_count INTEGER DEFAULT 0,
  view_count INTEGER DEFAULT 0,
  is_featured BOOLEAN DEFAULT false,
  is_published BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_educational_resources_category ON educational_resources(category);
CREATE INDEX IF NOT EXISTS idx_educational_resources_slug ON educational_resources(slug);
CREATE INDEX IF NOT EXISTS idx_educational_resources_is_published ON educational_resources(is_published);
CREATE INDEX IF NOT EXISTS idx_educational_resources_is_featured ON educational_resources(is_featured);
CREATE INDEX IF NOT EXISTS idx_educational_resources_tags ON educational_resources USING GIN(tags);

-- Create RLS policies
ALTER TABLE educational_resources ENABLE ROW LEVEL SECURITY;

-- Allow anyone to view published resources
DROP POLICY IF EXISTS "Published resources are viewable by everyone" ON educational_resources;
CREATE POLICY "Published resources are viewable by everyone" ON educational_resources
  FOR SELECT
  USING (is_published = true);

-- Create resource_analytics table for tracking interactions
CREATE TABLE IF NOT EXISTS resource_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id UUID NOT NULL REFERENCES educational_resources(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('view', 'download', 'share', 'complete')),
  session_id TEXT,
  user_agent TEXT,
  ip_address INET,
  referrer TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for analytics
CREATE INDEX IF NOT EXISTS idx_resource_analytics_resource_id ON resource_analytics(resource_id);
CREATE INDEX IF NOT EXISTS idx_resource_analytics_user_id ON resource_analytics(user_id);
CREATE INDEX IF NOT EXISTS idx_resource_analytics_event_type ON resource_analytics(event_type);
CREATE INDEX IF NOT EXISTS idx_resource_analytics_created_at ON resource_analytics(created_at);

-- RLS for analytics
ALTER TABLE resource_analytics ENABLE ROW LEVEL SECURITY;

-- Allow inserts from anyone (for tracking)
DROP POLICY IF EXISTS "Anyone can insert analytics" ON resource_analytics;
CREATE POLICY "Anyone can insert analytics" ON resource_analytics
  FOR INSERT
  WITH CHECK (true);

-- Only admins can view analytics (if user_profiles table with role column exists)
-- This will be skipped if the user_profiles table doesn't have a role column
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_profiles' 
    AND column_name = 'role'
  ) THEN
    DROP POLICY IF EXISTS "Admins can view analytics" ON resource_analytics;
    CREATE POLICY "Admins can view analytics" ON resource_analytics
      FOR SELECT
      USING (auth.jwt() ->> 'email' IN (
        SELECT email FROM user_profiles WHERE role = 'admin'
      ));
  END IF;
END $$;

-- Function to update resource counts
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

-- Trigger to auto-update counts
DROP TRIGGER IF EXISTS update_resource_counts_trigger ON resource_analytics;
CREATE TRIGGER update_resource_counts_trigger
AFTER INSERT ON resource_analytics
FOR EACH ROW
EXECUTE FUNCTION update_resource_counts();

-- Insert the initial resource (Introduction to Public Forum)
INSERT INTO educational_resources (
  title,
  slug,
  description,
  category,
  file_url,
  file_type,
  authors,
  tags,
  difficulty,
  duration_minutes,
  is_featured,
  is_published
) VALUES (
  'Introduction to Public Forum Debate',
  'intro-to-public-forum',
  'A comprehensive slideshow covering the fundamentals of Public Forum debate, including round structure, speech types, and strategic concepts. Perfect for beginners and those new to competitive debate.',
  'slideshows',
  '/resources/slideshows/intro-to-public-forum.pdf',
  'pdf',
  ARRAY['Sachin Buluswar', 'Kevin Cheng'],
  ARRAY['beginner', 'fundamentals', 'public-forum', 'round-structure', 'speeches'],
  'beginner',
  30,
  true,
  true
) ON CONFLICT (slug) DO NOTHING;