# Search System Architecture Documentation

## Overview

The DebateAI platform features two distinct search modes:
1. **Document Search** - Direct document chunk retrieval with context
2. **AI Assistant** - True RAG (Retrieval-Augmented Generation) with AI-generated responses

## Search Modes Explained

### Document Search Mode
- **Purpose**: Direct access to document chunks without AI interpretation
- **Endpoint**: `/api/wiki-document-search`
- **Returns**: Top N most relevant document chunks based on text similarity
- **Features**:
  - View surrounding context (chunks before/after)
  - Direct PDF navigation with page numbers
  - Relevance scoring based on term frequency and position
  - No AI processing - pure document retrieval

### AI Assistant Mode  
- **Purpose**: AI-powered search with generated comprehensive answers
- **Endpoint**: `/api/wiki-search`
- **Returns**: AI-generated response synthesizing information from multiple sources
- **Features**:
  - True RAG implementation
  - Contextual understanding of queries
  - Synthesized answers from multiple documents
  - Source citations included

## Architecture Components

### 1. Document Storage Layer

#### Supabase Storage
- **Bucket**: `debate-documents`
- **Access**: Public read access for all PDFs
- **Naming**: Timestamp + hash + filename for uniqueness

#### Database Schema
```sql
-- documents table: Stores PDF metadata
documents:
  - id: UUID (primary key)
  - title: Text
  - file_name: Text
  - file_url: Text (Supabase Storage URL)
  - page_count: Integer
  - source_type: Enum ('upload', 'opencaselist', 'other')
  - metadata: JSONB (camp, year, topic, etc.)
  - indexed_at: Timestamp

-- document_chunks table: Stores chunk positions
document_chunks:
  - id: UUID (primary key)
  - document_id: UUID (foreign key)
  - chunk_index: Integer
  - content: Text
  - page_number: Integer
  - page_start_char: Integer
  - page_end_char: Integer
  - openai_file_id: Text
  - section_title: Text
```

### 2. Document Search Implementation

#### Search Algorithm
1. **Primary Search**: PostgreSQL full-text search using `websearch_to_tsquery`
2. **Fallback Search**: ILIKE pattern matching for broader results
3. **Relevance Scoring**:
   - Exact phrase match: +10 points
   - Term frequency: +2 points per occurrence
   - Position bonus: Earlier chunks scored higher
   - Normalized to 0-1 range

#### Search Flow
```mermaid
graph LR
    A[User Query] --> B[Document Search API]
    B --> C[PostgreSQL Full-Text Search]
    C --> D[Score & Rank Results]
    D --> E[Retrieve Context Chunks]
    E --> F[Return Document Results]
```

### 3. AI Assistant Implementation

#### RAG Pipeline
1. **Retrieval**: Uses OpenAI Assistant API with vector store
2. **Augmentation**: Provides retrieved documents as context
3. **Generation**: AI generates comprehensive answer

#### Assistant Flow
```mermaid
graph LR
    A[User Query] --> B[AI Assistant API]
    B --> C[OpenAI Vector Search]
    C --> D[Retrieve Documents]
    D --> E[Generate AI Response]
    E --> F[Return Generated Answer]
```

### 4. UI Components

#### UnifiedSearchCard
- Supports both search modes
- Displays chunk content with expand/collapse
- Shows surrounding context for Document Search
- "View in PDF" button for direct navigation
- Page number and relevance score badges

#### SimplePDFViewer
- Modal PDF viewer
- Page navigation support
- Download option
- Fallback embed for compatibility

### 5. Indexing Pipeline

#### Enhanced Indexing Service
1. **PDF Processing**: Uses `pdf-parse` to extract text page by page
2. **Smart Chunking**: 
   - 800 token chunks with 200 token overlap
   - Preserves section boundaries
   - Tracks exact character positions
3. **Metadata Enrichment**:
   - Embeds source, page, and section info in each chunk
   - Maintains chunk relationships for context retrieval

## Usage Guide

### For Users

1. **Document Search**:
   - Select "Document Search" mode for direct access to documents
   - Best for finding specific evidence or quotes
   - Click "Show surrounding context" to see adjacent text
   - Click "View in PDF" to navigate to the exact page

2. **AI Assistant**:
   - Select "AI Assistant" mode for comprehensive answers
   - Best for understanding complex topics
   - AI synthesizes information from multiple sources
   - Sources are cited in the response

### For Administrators

1. **Upload Documents**:
   ```bash
   # Via admin UI
   Navigate to /admin/documents
   Click "Upload Document"
   
   # Via API
   POST /api/admin/upload-document
   ```

2. **Monitor System**:
   ```bash
   # Check system status
   GET /api/rag-status
   
   # Test document search
   node scripts/test-document-search.js
   ```

## API Reference

### Document Search Request
```typescript
POST /api/wiki-document-search
{
  "query": "string",
  "maxResults": 10 // optional, default 10
}
```

### Document Search Response
```typescript
{
  "success": true,
  "searchType": "document-search",
  "results": [{
    "content": "string",
    "source": "string", 
    "score": 0.95,
    "chunk_id": "uuid",
    "document_id": "uuid",
    "page_number": 42,
    "pdf_url": "https://...",
    "pdf_page_anchor": "#page=42",
    "context": {
      "before": "string",
      "after": "string"
    },
    "metadata": {
      "title": "string",
      "section": "string",
      "source_type": "opencaselist",
      "indexed_at": "2024-01-17T..."
    }
  }]
}
```

### AI Assistant Request
```typescript
POST /api/wiki-search
{
  "query": "string",
  "maxResults": 10 // optional
}
```

### AI Assistant Response
```typescript
{
  "success": true,
  "searchType": "ai-assistant",
  "results": [{
    "content": "AI-generated comprehensive answer...",
    "source": "Multiple sources",
    "metadata": {
      "sources": ["doc1.pdf", "doc2.pdf"],
      "confidence": 0.92
    }
  }]
}
```

## Performance Considerations

### Document Search
- Direct database queries - very fast
- No external API calls
- Results cached for 1 hour
- Scales with database performance

### AI Assistant
- Requires OpenAI API calls
- Higher latency due to generation
- More expensive per query
- Better for complex questions

## When to Use Which Mode

### Use Document Search When:
- Looking for specific evidence or quotes
- Need to verify exact wording
- Want to see full document context
- Speed is important
- Cost is a concern

### Use AI Assistant When:
- Need comprehensive understanding
- Want synthesized information
- Asking complex questions
- Need interpretation or analysis
- Quality matters more than speed

This dual-mode system provides users with flexibility to choose between direct document access and AI-enhanced search based on their specific needs.