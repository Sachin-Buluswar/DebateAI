-- Migration: Add document_chunks table, vector search, and supporting tables
-- Run this in Supabase Dashboard > SQL Editor

-- ===== 1. Alter existing documents table =====
ALTER TABLE public.documents ALTER COLUMN content DROP NOT NULL;
ALTER TABLE public.documents ALTER COLUMN content SET DEFAULT '';
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS file_size BIGINT;
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS source_url TEXT;

-- ===== 2. Create document_chunks table =====
CREATE TABLE IF NOT EXISTS public.document_chunks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  page_number INTEGER,
  page_start_char INTEGER,
  page_end_char INTEGER,
  doc_start_char INTEGER,
  doc_end_char INTEGER,
  section_title TEXT,
  openai_file_id TEXT,
  embedding vector(1536),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(document_id, chunk_index)
);

-- Indexes for document_chunks
CREATE INDEX IF NOT EXISTS idx_document_chunks_document_id ON public.document_chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_document_chunks_openai_file_id ON public.document_chunks(openai_file_id);
CREATE INDEX IF NOT EXISTS idx_document_chunks_page_number ON public.document_chunks(document_id, page_number);
CREATE INDEX IF NOT EXISTS idx_document_chunks_doc_chunk ON public.document_chunks(document_id, chunk_index);

-- HNSW index for vector similarity search
CREATE INDEX IF NOT EXISTS idx_document_chunks_embedding ON public.document_chunks
  USING hnsw (embedding vector_cosine_ops);

-- Full-text search
ALTER TABLE public.document_chunks ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (to_tsvector('english', content)) STORED;
CREATE INDEX IF NOT EXISTS idx_document_chunks_search_vector ON public.document_chunks USING GIN (search_vector);

-- Trigram for ILIKE fuzzy search
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_document_chunks_content_trgm ON public.document_chunks USING GIN (content gin_trgm_ops);

-- ===== 3. Create opencaselist_scrape_log table =====
CREATE TABLE IF NOT EXISTS public.opencaselist_scrape_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  url TEXT NOT NULL,
  status TEXT CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  document_id UUID REFERENCES public.documents(id),
  error_message TEXT,
  attempted_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ===== 4. Create search_results_cache table =====
CREATE TABLE IF NOT EXISTS public.search_results_cache (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  query_hash TEXT NOT NULL,
  query_text TEXT NOT NULL,
  results JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() + INTERVAL '1 hour'
);

CREATE INDEX IF NOT EXISTS idx_search_results_cache_query_hash ON public.search_results_cache(query_hash);
CREATE INDEX IF NOT EXISTS idx_search_results_cache_expires_at ON public.search_results_cache(expires_at);

-- ===== 5. RLS Policies =====
ALTER TABLE public.document_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opencaselist_scrape_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.search_results_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "document_chunks_public_read" ON public.document_chunks
  FOR SELECT USING (true);

CREATE POLICY "document_chunks_auth_insert" ON public.document_chunks
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "document_chunks_auth_update" ON public.document_chunks
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "document_chunks_auth_delete" ON public.document_chunks
  FOR DELETE USING (auth.role() = 'authenticated');

CREATE POLICY "scrape_log_auth_read" ON public.opencaselist_scrape_log
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "scrape_log_auth_insert" ON public.opencaselist_scrape_log
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "scrape_log_auth_update" ON public.opencaselist_scrape_log
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "cache_public_read" ON public.search_results_cache
  FOR SELECT USING (true);

CREATE POLICY "cache_auth_insert" ON public.search_results_cache
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- ===== 6. Database functions =====

-- Vector similarity search
CREATE OR REPLACE FUNCTION match_document_chunks(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.5,
  match_count int DEFAULT 10
)
RETURNS TABLE (
  id UUID,
  document_id UUID,
  content TEXT,
  page_number INTEGER,
  section_title TEXT,
  chunk_index INTEGER,
  similarity float
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    dc.id,
    dc.document_id,
    dc.content,
    dc.page_number,
    dc.section_title,
    dc.chunk_index,
    1 - (dc.embedding <=> query_embedding) AS similarity
  FROM document_chunks dc
  WHERE dc.embedding IS NOT NULL
    AND 1 - (dc.embedding <=> query_embedding) > match_threshold
  ORDER BY dc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Full-text search
CREATE OR REPLACE FUNCTION search_document_chunks(
  search_query TEXT,
  max_results INTEGER DEFAULT 10
)
RETURNS TABLE (
  id UUID,
  document_id UUID,
  content TEXT,
  page_number INTEGER,
  section_title TEXT,
  chunk_index INTEGER,
  rank REAL
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    dc.id,
    dc.document_id,
    dc.content,
    dc.page_number,
    dc.section_title,
    dc.chunk_index,
    ts_rank(dc.search_vector, websearch_to_tsquery('english', search_query)) AS rank
  FROM document_chunks dc
  WHERE dc.search_vector @@ websearch_to_tsquery('english', search_query)
  ORDER BY rank DESC
  LIMIT max_results;
END;
$$;

-- Cache cleanup
CREATE OR REPLACE FUNCTION clean_expired_cache()
RETURNS void AS $$
BEGIN
  DELETE FROM public.search_results_cache WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- ===== 7. Storage bucket =====
INSERT INTO storage.buckets (id, name, public)
VALUES ('debate-documents', 'debate-documents', true)
ON CONFLICT (id) DO NOTHING;

-- ===== 8. Permissions =====
GRANT EXECUTE ON FUNCTION match_document_chunks TO authenticated;
GRANT EXECUTE ON FUNCTION match_document_chunks TO anon;
GRANT EXECUTE ON FUNCTION search_document_chunks TO authenticated;
GRANT EXECUTE ON FUNCTION search_document_chunks TO anon;
