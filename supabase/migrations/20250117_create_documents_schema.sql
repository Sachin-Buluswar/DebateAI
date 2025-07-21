-- Create documents table to store metadata about uploaded PDFs
CREATE TABLE IF NOT EXISTS public.documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL, -- Supabase Storage URL
  file_size BIGINT,
  page_count INTEGER,
  source_url TEXT, -- Original URL if scraped from web
  source_type TEXT CHECK (source_type IN ('upload', 'opencaselist', 'other')),
  metadata JSONB DEFAULT '{}', -- Additional metadata (author, date, tags, etc.)
  indexed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create document_chunks table to store chunk metadata with position info
CREATE TABLE IF NOT EXISTS public.document_chunks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  page_number INTEGER,
  page_start_char INTEGER, -- Character position on the page
  page_end_char INTEGER,
  doc_start_char INTEGER, -- Character position in the entire document
  doc_end_char INTEGER,
  section_title TEXT,
  openai_file_id TEXT, -- Reference to OpenAI vector store file
  embedding vector(1536), -- Optional: store embeddings locally for faster search
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(document_id, chunk_index)
);

-- Create index for faster chunk lookups
CREATE INDEX idx_document_chunks_document_id ON public.document_chunks(document_id);
CREATE INDEX idx_document_chunks_openai_file_id ON public.document_chunks(openai_file_id);
CREATE INDEX idx_document_chunks_page_number ON public.document_chunks(document_id, page_number);

-- Create opencaselist_scrape_log table to track scraping progress
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

-- Create search_results_cache table for improved performance
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

-- Add RLS policies
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opencaselist_scrape_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.search_results_cache ENABLE ROW LEVEL SECURITY;

-- Documents are public readable
CREATE POLICY "Documents are publicly readable" ON public.documents
  FOR SELECT USING (true);

-- Document chunks are public readable
CREATE POLICY "Document chunks are publicly readable" ON public.document_chunks
  FOR SELECT USING (true);

-- Only authenticated users can manage documents
CREATE POLICY "Authenticated users can insert documents" ON public.documents
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update documents" ON public.documents
  FOR UPDATE WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete documents" ON public.documents
  FOR DELETE USING (auth.role() = 'authenticated');

-- Only authenticated users can manage chunks
CREATE POLICY "Authenticated users can manage chunks" ON public.document_chunks
  FOR ALL USING (auth.role() = 'authenticated');

-- Scrape log is admin only
CREATE POLICY "Admin only scrape log" ON public.opencaselist_scrape_log
  FOR ALL USING (auth.jwt() ->> 'email' = 'admin@erisdebate.com');

-- Search cache is public readable
CREATE POLICY "Search cache is publicly readable" ON public.search_results_cache
  FOR SELECT USING (true);

-- Function to clean expired cache entries
CREATE OR REPLACE FUNCTION clean_expired_cache()
RETURNS void AS $$
BEGIN
  DELETE FROM public.search_results_cache WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Create storage bucket for PDFs if not exists
INSERT INTO storage.buckets (id, name, public)
VALUES ('debate-documents', 'debate-documents', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public read access to PDFs
CREATE POLICY "Public can read PDFs" ON storage.objects
  FOR SELECT USING (bucket_id = 'debate-documents');

-- Allow authenticated users to upload PDFs
CREATE POLICY "Authenticated users can upload PDFs" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'debate-documents' 
    AND auth.role() = 'authenticated'
  );

-- Allow authenticated users to delete their PDFs
CREATE POLICY "Authenticated users can delete PDFs" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'debate-documents' 
    AND auth.role() = 'authenticated'
  );