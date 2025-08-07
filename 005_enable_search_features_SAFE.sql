-- Enable search features for the application (SAFE VERSION)
-- This migration enables full-text search and fuzzy matching capabilities
-- SAFE: Checks for existing objects before creating them

-- ============================================
-- 1. ENABLE REQUIRED EXTENSIONS
-- ============================================

-- Enable pg_trgm for fuzzy text search (trigram similarity)
CREATE EXTENSION IF NOT EXISTS pg_trgm SCHEMA public;

-- Enable vector extension for AI embeddings (if available)
DO $$ 
BEGIN
    CREATE EXTENSION IF NOT EXISTS vector SCHEMA public;
EXCEPTION 
    WHEN OTHERS THEN 
        RAISE NOTICE 'Vector extension not available, skipping...';
END $$;

-- ============================================
-- 2. CREATE FULL-TEXT SEARCH CONFIGURATIONS
-- ============================================

-- Add full-text search columns to debates table
ALTER TABLE debates 
ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- Create index for full-text search on debates
CREATE INDEX IF NOT EXISTS idx_debates_search_vector 
ON debates USING gin(search_vector);

-- Create trigger to automatically update search vector
CREATE OR REPLACE FUNCTION update_debates_search_vector()
RETURNS trigger AS $$
BEGIN
    NEW.search_vector := 
        setweight(to_tsvector('english', COALESCE(NEW.title, '')), 'A') ||
        setweight(to_tsvector('english', COALESCE(NEW.topic, '')), 'B') ||
        setweight(to_tsvector('english', COALESCE(NEW.description, '')), 'C');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_debates_search_vector ON debates;
CREATE TRIGGER trigger_update_debates_search_vector
    BEFORE INSERT OR UPDATE OF title, topic, description
    ON debates
    FOR EACH ROW
    EXECUTE FUNCTION update_debates_search_vector();

-- Update existing records
UPDATE debates 
SET search_vector = 
    setweight(to_tsvector('english', COALESCE(title, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(topic, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(description, '')), 'C')
WHERE search_vector IS NULL;

-- ============================================
-- 3. ADD TRIGRAM INDEXES FOR FUZZY SEARCH
-- ============================================

-- Add trigram indexes for fuzzy matching on text fields
CREATE INDEX IF NOT EXISTS idx_debates_title_trgm 
ON debates USING gin(title gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_debates_topic_trgm 
ON debates USING gin(topic gin_trgm_ops);

-- Add trigram indexes for speech_feedback
ALTER TABLE speech_feedback 
ADD COLUMN IF NOT EXISTS search_vector tsvector;

CREATE INDEX IF NOT EXISTS idx_speech_feedback_search_vector 
ON speech_feedback USING gin(search_vector);

-- Create trigger for speech_feedback search vector
CREATE OR REPLACE FUNCTION update_speech_feedback_search_vector()
RETURNS trigger AS $$
BEGIN
    NEW.search_vector := 
        setweight(to_tsvector('english', COALESCE(NEW.transcription, '')), 'A') ||
        setweight(to_tsvector('english', COALESCE(NEW.topic, '')), 'B') ||
        setweight(to_tsvector('english', COALESCE(NEW.feedback::text, '')), 'C');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_speech_feedback_search_vector ON speech_feedback;
CREATE TRIGGER trigger_update_speech_feedback_search_vector
    BEFORE INSERT OR UPDATE OF transcription, topic, feedback
    ON speech_feedback
    FOR EACH ROW
    EXECUTE FUNCTION update_speech_feedback_search_vector();

-- Update existing speech_feedback records
UPDATE speech_feedback 
SET search_vector = 
    setweight(to_tsvector('english', COALESCE(transcription, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(topic, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(feedback::text, '')), 'C')
WHERE search_vector IS NULL;

-- ============================================
-- 4. CREATE SEARCH FUNCTIONS
-- ============================================

-- Function to search debates using full-text search
CREATE OR REPLACE FUNCTION search_debates(search_query text)
RETURNS TABLE(
    id uuid,
    title text,
    topic text,
    description text,
    rank real
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        d.id,
        d.title,
        d.topic,
        d.description,
        ts_rank(d.search_vector, websearch_to_tsquery('english', search_query)) as rank
    FROM debates d
    WHERE d.search_vector @@ websearch_to_tsquery('english', search_query)
    ORDER BY rank DESC;
END;
$$ LANGUAGE plpgsql;

-- Function for fuzzy search on debates
CREATE OR REPLACE FUNCTION fuzzy_search_debates(search_query text, threshold real DEFAULT 0.3)
RETURNS TABLE(
    id uuid,
    title text,
    topic text,
    description text,
    similarity real
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        d.id,
        d.title,
        d.topic,
        d.description,
        GREATEST(
            similarity(d.title, search_query),
            similarity(d.topic, search_query),
            COALESCE(similarity(d.description, search_query), 0)
        ) as similarity
    FROM debates d
    WHERE 
        similarity(d.title, search_query) > threshold OR
        similarity(d.topic, search_query) > threshold OR
        similarity(COALESCE(d.description, ''), search_query) > threshold
    ORDER BY similarity DESC;
END;
$$ LANGUAGE plpgsql;

-- Function to search speech feedback
CREATE OR REPLACE FUNCTION search_speech_feedback(search_query text)
RETURNS TABLE(
    id uuid,
    topic text,
    transcription text,
    rank real
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        f.id,
        f.topic,
        f.transcription,
        ts_rank(f.search_vector, websearch_to_tsquery('english', search_query)) as rank
    FROM speech_feedback f
    WHERE f.search_vector @@ websearch_to_tsquery('english', search_query)
    ORDER BY rank DESC;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 5. CREATE DOCUMENTS TABLE FOR WIKI/RAG (SAFE)
-- ============================================

-- Check if documents table exists
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'documents') THEN
        -- Try to create with vector type if available, otherwise without
        IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') THEN
            CREATE TABLE documents (
                id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                title text NOT NULL,
                content text NOT NULL,
                metadata jsonb,
                embedding vector(1536),
                search_vector tsvector,
                created_at timestamptz DEFAULT now(),
                updated_at timestamptz DEFAULT now(),
                user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
                source_type text DEFAULT 'manual',
                file_name text,
                file_url text,
                page_count integer,
                indexed_at timestamptz
            );
        ELSE
            CREATE TABLE documents (
                id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                title text NOT NULL,
                content text NOT NULL,
                metadata jsonb,
                search_vector tsvector,
                created_at timestamptz DEFAULT now(),
                updated_at timestamptz DEFAULT now(),
                user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
                source_type text DEFAULT 'manual',
                file_name text,
                file_url text,
                page_count integer,
                indexed_at timestamptz
            );
        END IF;
        
        -- Enable RLS on documents
        ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
    END IF;
END $$;

-- RLS policies for documents (SAFE - checks for existence first)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'documents' 
        AND policyname = 'Users can view all documents'
    ) THEN
        CREATE POLICY "Users can view all documents" ON documents
            FOR SELECT
            TO authenticated
            USING (true);
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'documents' 
        AND policyname = 'Users can create documents'
    ) THEN
        CREATE POLICY "Users can create documents" ON documents
            FOR INSERT
            TO authenticated
            WITH CHECK (user_id = (SELECT auth.uid()));
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'documents' 
        AND policyname = 'Users can update own documents'
    ) THEN
        CREATE POLICY "Users can update own documents" ON documents
            FOR UPDATE
            TO authenticated
            USING (user_id = (SELECT auth.uid()))
            WITH CHECK (user_id = (SELECT auth.uid()));
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'documents' 
        AND policyname = 'Users can delete own documents'
    ) THEN
        CREATE POLICY "Users can delete own documents" ON documents
            FOR DELETE
            TO authenticated
            USING (user_id = (SELECT auth.uid()));
    END IF;
END $$;

-- Indexes for documents
CREATE INDEX IF NOT EXISTS idx_documents_search_vector 
ON documents USING gin(search_vector);

-- Only create vector index if vector extension is available
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') THEN
        EXECUTE 'CREATE INDEX IF NOT EXISTS idx_documents_embedding ON documents USING ivfflat(embedding vector_cosine_ops)';
    END IF;
END $$;

-- Trigger for documents search vector (only if table exists)
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'documents') THEN
        CREATE OR REPLACE FUNCTION update_documents_search_vector()
        RETURNS trigger AS $func$
        BEGIN
            NEW.search_vector := 
                setweight(to_tsvector('english', COALESCE(NEW.title, '')), 'A') ||
                setweight(to_tsvector('english', COALESCE(NEW.content, '')), 'B');
            RETURN NEW;
        END;
        $func$ LANGUAGE plpgsql;
        
        DROP TRIGGER IF EXISTS trigger_update_documents_search_vector ON documents;
        CREATE TRIGGER trigger_update_documents_search_vector
            BEFORE INSERT OR UPDATE OF title, content
            ON documents
            FOR EACH ROW
            EXECUTE FUNCTION update_documents_search_vector();
    END IF;
END $$;

-- ============================================
-- 6. ADD TRIGRAM INDEXES FOR OTHER TABLES
-- ============================================

-- Add trigram index for speech_feedback topic and transcription
CREATE INDEX IF NOT EXISTS idx_speech_feedback_topic_trgm 
ON speech_feedback USING gin(topic gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_speech_feedback_transcription_trgm 
ON speech_feedback USING gin(transcription gin_trgm_ops);

-- ============================================
-- SUCCESS MESSAGE
-- ============================================
DO $$ 
BEGIN
    RAISE NOTICE 'Search features successfully enabled!';
    RAISE NOTICE 'Full-text search and fuzzy matching are now available.';
    RAISE NOTICE 'Documents table created/verified for wiki/RAG functionality.';
END $$;