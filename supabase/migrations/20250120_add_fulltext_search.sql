-- Add full-text search support to document_chunks table
-- This migration adds GIN indexes and search configuration for better text search

-- Create a text search configuration for English (if not exists)
CREATE TEXT SEARCH CONFIGURATION IF NOT EXISTS english (COPY = pg_catalog.english);

-- Add a generated column for text search vector (if not exists)
ALTER TABLE document_chunks 
ADD COLUMN IF NOT EXISTS search_vector tsvector 
GENERATED ALWAYS AS (to_tsvector('english', content)) STORED;

-- Create GIN index on the search vector for fast full-text search
CREATE INDEX IF NOT EXISTS idx_document_chunks_search_vector 
ON document_chunks USING GIN (search_vector);

-- Create a simple text pattern index for ILIKE queries (trigram index)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_document_chunks_content_trgm 
ON document_chunks USING GIN (content gin_trgm_ops);

-- Add index on document_id and chunk_index for context retrieval
CREATE INDEX IF NOT EXISTS idx_document_chunks_doc_chunk 
ON document_chunks(document_id, chunk_index);

-- Create a function to search document chunks with ranking
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

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION search_document_chunks TO authenticated;

-- Add comment explaining the search functionality
COMMENT ON FUNCTION search_document_chunks IS 'Performs full-text search on document chunks with relevance ranking';
COMMENT ON INDEX idx_document_chunks_search_vector IS 'GIN index for fast full-text search using tsvector';
COMMENT ON INDEX idx_document_chunks_content_trgm IS 'Trigram index for fuzzy text matching and ILIKE queries';