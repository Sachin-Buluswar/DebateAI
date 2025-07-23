# Eris Debate Search System Setup Instructions

## Critical Issues to Fix

The search system is currently non-functional due to missing database infrastructure. Follow these steps to fix:

## 1. Apply Database Migrations

The migrations need to be run directly in the Supabase SQL editor since the automated script isn't working properly.

### Step 1: Create Documents Tables

Go to your Supabase Dashboard SQL Editor and run:

```sql
-- From: supabase/migrations/20250117_create_documents_schema.sql

-- Create documents table to store metadata about uploaded PDFs
CREATE TABLE IF NOT EXISTS public.documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size BIGINT,
  page_count INTEGER,
  source_url TEXT,
  source_type TEXT CHECK (source_type IN ('upload', 'opencaselist', 'other')),
  metadata JSONB DEFAULT '{}',
  indexed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create document_chunks table
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

-- Create indexes
CREATE INDEX idx_document_chunks_document_id ON public.document_chunks(document_id);
CREATE INDEX idx_document_chunks_openai_file_id ON public.document_chunks(openai_file_id);
CREATE INDEX idx_document_chunks_page_number ON public.document_chunks(document_id, page_number);

-- Create other tables (opencaselist_scrape_log, search_results_cache)
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

CREATE TABLE IF NOT EXISTS public.search_results_cache (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  query_hash TEXT NOT NULL,
  query_text TEXT NOT NULL,
  results JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() + INTERVAL '1 hour'
);

CREATE INDEX idx_search_results_cache_query_hash ON public.search_results_cache(query_hash);
CREATE INDEX idx_search_results_cache_expires_at ON public.search_results_cache(expires_at);

-- Enable RLS
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opencaselist_scrape_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.search_results_cache ENABLE ROW LEVEL SECURITY;

-- Add RLS policies
CREATE POLICY "Documents are publicly readable" ON public.documents
  FOR SELECT USING (true);

CREATE POLICY "Document chunks are publicly readable" ON public.document_chunks
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can insert documents" ON public.documents
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update documents" ON public.documents
  FOR UPDATE WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete documents" ON public.documents
  FOR DELETE USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can manage chunks" ON public.document_chunks
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Admin only scrape log" ON public.opencaselist_scrape_log
  FOR ALL USING (auth.jwt() ->> 'email' = 'admin@atlasdebate.com');

CREATE POLICY "Search cache is publicly readable" ON public.search_results_cache
  FOR SELECT USING (true);

-- Function to clean expired cache
CREATE OR REPLACE FUNCTION clean_expired_cache()
RETURNS void AS $$
BEGIN
  DELETE FROM public.search_results_cache WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;
```

### Step 2: Add Full-Text Search Support

Run this in SQL Editor:

```sql
-- From: supabase/migrations/20250120_add_fulltext_search.sql

-- Enable pg_trgm extension first
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Add text search configuration
CREATE TEXT SEARCH CONFIGURATION IF NOT EXISTS english (COPY = pg_catalog.english);

-- Add search vector column
ALTER TABLE document_chunks 
ADD COLUMN IF NOT EXISTS search_vector tsvector 
GENERATED ALWAYS AS (to_tsvector('english', content)) STORED;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_document_chunks_search_vector 
ON document_chunks USING GIN (search_vector);

CREATE INDEX IF NOT EXISTS idx_document_chunks_content_trgm 
ON document_chunks USING GIN (content gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_document_chunks_doc_chunk 
ON document_chunks(document_id, chunk_index);

-- Create search function
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

GRANT EXECUTE ON FUNCTION search_document_chunks TO authenticated;
```

## 2. Create Storage Bucket

In Supabase Dashboard:

1. Go to Storage section
2. Click "New bucket"
3. Name: `debate-documents`
4. Public bucket: ✅ (check this)
5. File size limit: 50MB
6. Allowed MIME types: `application/pdf`

Or run this SQL:

```sql
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'debate-documents', 
  'debate-documents', 
  true,
  52428800, -- 50MB
  ARRAY['application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Public can read PDFs" ON storage.objects
  FOR SELECT USING (bucket_id = 'debate-documents');

CREATE POLICY "Authenticated users can upload PDFs" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'debate-documents' 
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "Authenticated users can delete PDFs" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'debate-documents' 
    AND auth.role() = 'authenticated'
  );
```

## 3. Enable Required Extensions

In Supabase Dashboard > Database > Extensions, enable:

1. **pg_trgm** - For fuzzy text search
2. **vector** - For embeddings (if using local embeddings)

## 4. Verify Setup

After completing the above steps, run:

```bash
npm run db:check
```

Or check the RAG status endpoint:
```bash
curl http://localhost:3001/api/rag-status
```

You should see:
- Database connected: ✅
- Storage bucket exists: ✅
- Full-text search enabled: ✅
- pg_trgm enabled: ✅

## 5. Upload Test Documents

Once the infrastructure is set up, you can:

1. Navigate to `/admin/documents` (requires auth)
2. Upload PDF documents
3. Wait for indexing to complete
4. Test search functionality

## Next Steps

After setup is complete:

1. Upload debate evidence PDFs
2. Configure OpenCaseList scraping (optional)
3. Test search functionality at `/search`
4. Monitor indexing status in admin panel

## Troubleshooting

If foreign key errors persist after creating tables:

1. Restart your Supabase project
2. Clear PostgREST schema cache:
   - In Dashboard > Settings > API
   - Click "Reload schema cache"
3. Restart your development server

If search returns no results:

1. Verify documents are indexed (check `indexed_at` field)
2. Check that full-text indexes were created
3. Try simpler search queries
4. Check browser console for API errors