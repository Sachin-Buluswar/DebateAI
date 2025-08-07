-- Create educational_resources table (SAFE VERSION)
-- This migration creates tables for the learn feature with public read access
-- Resources can be viewed and downloaded without authentication
-- SAFE: Checks for existing objects before creating them

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

-- Create indexes for performance (IF NOT EXISTS)
CREATE INDEX IF NOT EXISTS idx_educational_resources_category ON educational_resources(category);
CREATE INDEX IF NOT EXISTS idx_educational_resources_slug ON educational_resources(slug);
CREATE INDEX IF NOT EXISTS idx_educational_resources_is_published ON educational_resources(is_published);
CREATE INDEX IF NOT EXISTS idx_educational_resources_is_featured ON educational_resources(is_featured);
CREATE INDEX IF NOT EXISTS idx_educational_resources_tags ON educational_resources USING GIN(tags);

-- Enable RLS if not already enabled
DO $$ 
BEGIN
    ALTER TABLE educational_resources ENABLE ROW LEVEL SECURITY;
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

-- Create RLS policies (check for existence first)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'educational_resources' 
        AND policyname = 'Published resources are viewable by everyone'
    ) THEN
        CREATE POLICY "Published resources are viewable by everyone" ON educational_resources
          FOR SELECT
          USING (is_published = true);
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'educational_resources' 
        AND policyname = 'Admins can manage resources'
    ) THEN
        CREATE POLICY "Admins can manage resources" ON educational_resources
          FOR ALL
          USING (
            EXISTS (
              SELECT 1 FROM user_roles 
              WHERE user_id = auth.uid() 
              AND role IN ('admin', 'super_admin')
            )
          );
    END IF;
END $$;

-- Create tracking table for resource analytics (IF NOT EXISTS)
CREATE TABLE IF NOT EXISTS resource_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id UUID REFERENCES educational_resources(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('view', 'download', 'complete')),
  session_id TEXT,
  ip_address INET,
  user_agent TEXT,
  referrer TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for analytics table (IF NOT EXISTS)
CREATE INDEX IF NOT EXISTS idx_resource_analytics_resource_id ON resource_analytics(resource_id);
CREATE INDEX IF NOT EXISTS idx_resource_analytics_user_id ON resource_analytics(user_id);
CREATE INDEX IF NOT EXISTS idx_resource_analytics_event_type ON resource_analytics(event_type);
CREATE INDEX IF NOT EXISTS idx_resource_analytics_created_at ON resource_analytics(created_at DESC);

-- Enable RLS on analytics table
DO $$ 
BEGIN
    ALTER TABLE resource_analytics ENABLE ROW LEVEL SECURITY;
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

-- Analytics policies (check for existence)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'resource_analytics' 
        AND policyname = 'Users can create analytics events'
    ) THEN
        CREATE POLICY "Users can create analytics events" ON resource_analytics
          FOR INSERT
          WITH CHECK (true);
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'resource_analytics' 
        AND policyname = 'Admins can view all analytics'
    ) THEN
        CREATE POLICY "Admins can view all analytics" ON resource_analytics
          FOR SELECT
          USING (
            EXISTS (
              SELECT 1 FROM user_roles 
              WHERE user_id = auth.uid() 
              AND role IN ('admin', 'super_admin')
            )
          );
    END IF;
END $$;

-- Create trigger to update download_count and view_count (SAFE)
CREATE OR REPLACE FUNCTION update_resource_counts()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.event_type = 'download' THEN
    UPDATE educational_resources 
    SET download_count = download_count + 1
    WHERE id = NEW.resource_id;
  ELSIF NEW.event_type = 'view' THEN
    UPDATE educational_resources 
    SET view_count = view_count + 1
    WHERE id = NEW.resource_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop and recreate trigger to ensure it's up to date
DROP TRIGGER IF EXISTS trigger_update_resource_counts ON resource_analytics;
CREATE TRIGGER trigger_update_resource_counts
  AFTER INSERT ON resource_analytics
  FOR EACH ROW
  EXECUTE FUNCTION update_resource_counts();

-- Create updated_at trigger (SAFE)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop and recreate trigger to ensure it's up to date
DROP TRIGGER IF EXISTS update_educational_resources_updated_at ON educational_resources;
CREATE TRIGGER update_educational_resources_updated_at
  BEFORE UPDATE ON educational_resources
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Success message
DO $$ 
BEGIN
    RAISE NOTICE 'Educational resources tables and policies created/verified successfully!';
END $$;