# Document Search System Implementation Guide

## Overview

The Eris Debate Document Search system provides direct document search functionality using PostgreSQL full-text search with Supabase for efficient document retrieval. This is distinct from the AI Assistant mode which implements true RAG (Retrieval-Augmented Generation).

## Architecture

### Components

1. **Direct Document Search API** (`/api/wiki-document-search`)
   - Performs database searches using PostgreSQL full-text search
   - Returns top N results based on relevance scoring
   - No dependency on OpenAI Assistant API
   - Always returns results (empty array if no matches)

2. **Document Storage**
   - Documents stored in Supabase Storage bucket (`debate-documents`)
   - Metadata in `documents` table
   - Content chunks in `document_chunks` table
   - Full-text search indexes for performance

3. **Search Modes**
   - **Document Search Mode**: Direct database search, returns document chunks with context
   - **AI Assistant Mode**: Uses OpenAI for true RAG - retrieves documents and generates AI responses

## Setup Instructions

### 1. Database Migration

Run the following migrations in order:

```sql
-- 1. Document schema (if not already applied)
/supabase/migrations/20250117_create_documents_schema.sql

-- 2. Full-text search support
/supabase/migrations/20250120_add_fulltext_search.sql

-- 3. User roles for admin access
/supabase/migrations/20250120_create_user_roles.sql
```

### 2. Environment Variables

Ensure these are set in your `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
OPENAI_API_KEY=your_openai_key (required for AI Assistant mode)
OPENAI_VECTOR_STORE_ID=your_vector_store_id (required for AI Assistant mode)
```

### 3. Upload Documents

#### Via Admin UI

1. Navigate to `/admin/documents`
2. Click "Upload Document"
3. Select PDF or TXT files
4. Wait for indexing to complete

#### Via Script

```bash
# Check existing documents
node scripts/check-documents.js

# Upload test document
node scripts/upload-test-document.js

# Test search functionality
node scripts/test-document-search.js
```

#### Via API

```javascript
const formData = new FormData();
formData.append('file', file);

const response = await fetch('/api/admin/upload-document', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`
  },
  body: formData
});
```

## Search Implementation

### Direct Document Search Algorithm

1. **Primary Search**: PostgreSQL full-text search using `websearch_to_tsquery`
2. **Fallback Search**: ILIKE pattern matching for broader results
3. **Relevance Scoring**:
   - Exact phrase match: +10 points
   - Term frequency: +2 points per occurrence
   - Position bonus: Earlier chunks scored higher
   - Normalized to 0-1 range

### Example Search Request

```javascript
const response = await fetch('/api/wiki-document-search', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    query: 'US China relationship',
    maxResults: 10
  })
});

const data = await response.json();
// data.results contains EnhancedSearchResult[]
```

### Response Format

```typescript
interface EnhancedSearchResult {
  content: string;           // Chunk text
  source: string;           // Document filename
  score: number;            // Relevance score (0-1)
  chunk_id: string;         // Unique chunk ID
  document_id: string;      // Parent document ID
  page_number?: number;     // PDF page number
  pdf_url: string;          // Direct PDF link
  pdf_page_anchor?: string; // #page=N for navigation
  context: {
    before: string;         // Previous chunks
    after: string;          // Following chunks
  };
  metadata: {
    title: string;
    section?: string;
    source_type: string;
    indexed_at?: string;
  };
}
```

## Troubleshooting

### No Search Results

1. **Check if documents exist**:
   ```bash
   node scripts/check-documents.js
   ```

2. **Verify full-text search is enabled**:
   ```sql
   SELECT * FROM pg_extension WHERE extname = 'pg_trgm';
   ```

3. **Test direct database search**:
   ```sql
   SELECT * FROM document_chunks 
   WHERE to_tsvector('english', content) @@ websearch_to_tsquery('english', 'your query')
   LIMIT 5;
   ```

### Upload Issues

1. **Check storage bucket exists**:
   - Go to Supabase Dashboard > Storage
   - Ensure `debate-documents` bucket exists
   - Check bucket is public

2. **Verify admin access**:
   - User must have `admin` role in `user_roles` table
   - Check with: `SELECT * FROM user_roles WHERE user_id = 'your-user-id';`

### Performance Issues

1. **Check indexes exist**:
   ```sql
   SELECT indexname FROM pg_indexes 
   WHERE tablename = 'document_chunks';
   ```

2. **Analyze query performance**:
   ```sql
   EXPLAIN ANALYZE 
   SELECT * FROM search_document_chunks('your query', 10);
   ```

## Best Practices

1. **Document Chunking**
   - Keep chunks between 500-1500 characters
   - Preserve paragraph boundaries
   - Include section titles for context

2. **Search Queries**
   - Use specific terms for better results
   - Longer queries generally return more relevant results
   - Avoid stop words (the, is, at, etc.)

3. **Performance Optimization**
   - Index documents in batches
   - Use the search results cache for repeated queries
   - Limit context retrieval to 2-3 surrounding chunks

## API Endpoints

### Document Search
- **Endpoint**: `POST /api/wiki-document-search`
- **Purpose**: Direct database search for document chunks with context
- **Returns**: Always returns results array (empty if no matches)

### Document Upload
- **Endpoint**: `POST /api/admin/upload-document`
- **Purpose**: Upload and index PDF/TXT documents
- **Auth**: Requires admin role

### Document Management
- **Page**: `/admin/documents`
- **Features**: View, upload, reindex, delete documents

## Future Enhancements

1. **Vector Embeddings**: Add semantic search using pgvector
2. **Multi-language Support**: Configure text search for other languages
3. **OCR Support**: Extract text from scanned PDFs
4. **Incremental Indexing**: Update only changed documents
5. **Search Analytics**: Track popular queries and click-through rates