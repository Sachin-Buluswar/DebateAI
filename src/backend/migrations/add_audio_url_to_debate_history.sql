-- Create educational_resources table
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

-- Enable RLS
ALTER TABLE educational_resources ENABLE ROW LEVEL SECURITY;

-- Allow anyone to view published resources
CREATE POLICY "Published resources are viewable by everyone" ON educational_resources
  FOR SELECT
  USING (is_published = true);

-- Insert the initial resource
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