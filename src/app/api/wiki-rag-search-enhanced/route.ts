/**
 * Eris Debate - Enhanced RAG Search API Endpoint
 * 
 * Advanced implementation of RAG search that enriches results with additional metadata
 * and context from both OpenAI's vector store and local database.
 * 
 * Key enhancements over basic RAG search:
 * 1. PDF Integration: Direct links to source PDFs with page anchors
 * 2. Extended Context: Retrieves surrounding chunks for better understanding
 * 3. Result Caching: MD5-based cache for frequently searched queries
 * 4. Dual Storage: Combines OpenAI vector store with local Supabase metadata
 * 5. Rich Metadata: Section titles, document types, indexing timestamps
 * 
 * Architecture:
 * - OpenAI Vector Store: Handles semantic search and embeddings
 * - Supabase Database: Stores document metadata and chunk relationships
 * - DocumentStorageService: Bridges the two storage systems
 * 
 * This endpoint is ideal for UI components that need to display rich search results
 * with direct navigation to source documents.
 * 
 * @endpoint POST /api/wiki-rag-search-enhanced  
 * @param {string} query - Search query text
 * @param {number} maxResults - Maximum results (default: 10, max: 20)
 * @returns {EnhancedSearchResult[]} Rich search results with PDF links and context
 */

import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { wikiSearchRateLimiter, withRateLimit } from '@/middleware/rateLimiter';
import {
  validateRequest,
  validationSchemas,
  addSecurityHeaders,
} from '@/middleware/inputValidation';
import { DocumentStorageService } from '@/backend/services/documentStorageService';
import { EnhancedSearchResult } from '@/types/documents';
import crypto from 'crypto';

// Get environment variables
const openaiApiKey = process.env.OPENAI_API_KEY;
const vectorStoreId = process.env.OPENAI_VECTOR_STORE_ID;

// Initialize services
// OpenAI client: Lazy initialization for better error handling
// DocumentStorageService: Handles database operations and caching
// The service provides methods to:
// - Map OpenAI file IDs to local database records
// - Retrieve chunk context (before/after chunks)
// - Cache search results for performance
let openai: OpenAI | null = null;
const documentStorage = new DocumentStorageService();

/**
 * performEnhancedRagSearch - Advanced RAG search with metadata enrichment
 * 
 * This function extends basic RAG search with several enhancements:
 * 
 * 1. Result Caching:
 *    - Uses MD5 hash of query as cache key
 *    - Caches results for 15 minutes (configurable)
 *    - Significantly improves response time for repeated queries
 * 
 * 2. OpenAI Integration:
 *    - Creates temporary assistant with file_search capability
 *    - Assistant searches across pre-indexed vector store
 *    - Extracts file citations from assistant responses
 * 
 * 3. Metadata Enrichment Process:
 *    - For each OpenAI file citation, looks up local database record
 *    - Retrieves full document metadata (title, URL, type)
 *    - Fetches surrounding chunks for context
 *    - Builds PDF page anchors for direct navigation
 * 
 * 4. Fallback Handling:
 *    - If chunk not in local DB, falls back to OpenAI file metadata
 *    - Ensures results even for recently indexed documents
 * 
 * 5. Resource Cleanup:
 *    - Deletes temporary threads and assistants after use
 *    - Handles cleanup errors gracefully to ensure data is returned
 * 
 * @param {OpenAI} openai - Initialized OpenAI client
 * @param {string} vectorStoreId - ID of the vector store to search
 * @param {string} query - User's search query
 * @param {number} maxResults - Maximum results to return
 * @returns {Promise<EnhancedSearchResult[]>} Enriched search results
 */
async function performEnhancedRagSearch(
  openai: OpenAI,
  vectorStoreId: string,
  query: string,
  maxResults: number = 10
): Promise<EnhancedSearchResult[]> {
  let tempAssistant: { id: string } | undefined;
  let thread: { id: string } | undefined;
  
  try {
    // Check cache first for performance optimization
    // Cache key is MD5 hash of query for consistent lookups
    // This dramatically improves response time for common queries
    // Cache TTL is managed by DocumentStorageService (default: 15 min)
    const cacheKey = crypto.createHash('md5').update(query).digest('hex');
    const cachedResults = await documentStorage.getSearchResultsCache(cacheKey) as EnhancedSearchResult[] | null;
    if (cachedResults) {
      return cachedResults;
    }

    // Create a temporary assistant for vector search
    tempAssistant = await openai.beta.assistants.create({
      name: 'Enhanced RAG Search Assistant',
      instructions: `You are a document search assistant. Search for relevant information and return the exact document chunks that match the query.`,
      model: 'gpt-4o',
      tools: [{ type: 'file_search' }],
      tool_resources: {
        file_search: {
          vector_store_ids: [vectorStoreId],
        },
      },
    });

    // Create thread and run search
    thread = await openai.beta.threads.create();

    await openai.beta.threads.messages.create(thread.id, {
      role: 'user',
      content: `Search for information about: "${query}"`,
    });

    let run = await openai.beta.threads.runs.create(thread.id, {
      assistant_id: tempAssistant.id,
    });

    // Poll for completion
    while (['queued', 'in_progress', 'requires_action'].includes(run.status)) {
      await new Promise((r) => setTimeout(r, 1000));
      run = await openai.beta.threads.runs.retrieve(run.id, {
        thread_id: thread.id,
      });
    }

    if (run.status !== 'completed') {
      throw new Error(`Search failed with status: ${run.status}`);
    }

    // Get messages and extract file citations
    const messages = await openai.beta.threads.messages.list(thread.id, { order: 'desc' });
    const assistantMessage = messages.data.find((msg) => msg.role === 'assistant');

    const enhancedResults: EnhancedSearchResult[] = [];

    if (assistantMessage) {
      for (const content of assistantMessage.content) {
        if (content.type === 'text') {
          const annotations = content.text.annotations || [];
          const citations = annotations.filter((a) => 'file_citation' in a);

          for (let i = 0; i < citations.length && enhancedResults.length < maxResults; i++) {
            const citation = citations[i] as { file_citation?: { file_id: string }; text?: string };
            const openaiFileId = citation.file_citation?.file_id;

            if (!openaiFileId) continue;

            // Look up chunk metadata in our database
            // This bridges OpenAI's file IDs with our local document structure
            // The mapping allows us to retrieve rich metadata not stored in OpenAI
            const chunk = await documentStorage.getChunkByOpenAIFileId(openaiFileId);

            if (chunk) {
              // Get surrounding context for better comprehension
              // Retrieves the chunks before and after the matched chunk
              // This helps users understand the full argument or explanation
              // without needing to open the source document
              const contextData = await documentStorage.getChunkWithContext(chunk.id);

              if (contextData) {
                const { document, before, after } = contextData;

                // Build PDF URL with page anchor for direct navigation
                // PDF viewers support #page=N anchors to jump to specific pages
                // This creates a seamless experience from search to source
                const pdfPageAnchor = chunk.page_number ? `#page=${chunk.page_number}` : '';

                enhancedResults.push({
                  content: chunk.content,
                  source: document.file_name,
                  score: Math.max(0.1, 1.0 - i * 0.1),
                  chunk_id: chunk.id,
                  document_id: document.id,
                  page_number: chunk.page_number,
                  pdf_url: document.file_url,
                  pdf_page_anchor: pdfPageAnchor,
                  context: {
                    before: before.map(c => c.content).join('\n\n'),
                    after: after.map(c => c.content).join('\n\n'),
                  },
                  metadata: {
                    title: document.title,
                    section: chunk.section_title,
                    source_type: document.source_type,
                    indexed_at: document.indexed_at,
                  },
                });
              }
            } else {
              // Fallback for chunks not in our database yet
              try {
                const file = await openai.files.retrieve(openaiFileId);
                enhancedResults.push({
                  content: content.text.value.substring(0, 500),
                  source: file.filename || 'Unknown',
                  score: Math.max(0.1, 1.0 - i * 0.1),
                  chunk_id: openaiFileId,
                  document_id: 'legacy',
                  pdf_url: '',
                  context: {
                    before: '',
                    after: '',
                  },
                  metadata: {
                    title: file.filename || 'Unknown',
                    source_type: 'other',
                  },
                });
              } catch (_e) {
                // PRODUCTION: Logging disabled
// console.warn(`Could not retrieve file info for ${openaiFileId}`);
              }
            }
          }
        }
      }
    }

    // Cache results before cleanup to ensure we have data
    // Caching is done after result generation but before cleanup
    // This ensures results are available even if cleanup fails
    // Cache failures are non-critical - we log but continue
    if (enhancedResults.length > 0) {
      try {
        await documentStorage.setSearchResultsCache(query, enhancedResults);
      } catch (_cacheError) {
        // PRODUCTION: Logging disabled
// console.warn('[enhanced-rag-search] Failed to cache results:', _cacheError);
        // Continue - caching is not critical
      }
    }

    // Cleanup resources to prevent OpenAI account pollution
    // OpenAI charges for stored assistants and threads
    // We create temporary resources for each search, so cleanup is essential
    // Cleanup errors are logged but don't fail the request
    // This ensures users get results even if cleanup partially fails
    const cleanupErrors = [];
    
    try {
      await openai.beta.threads.delete(thread!.id);
    } catch (_error) {
      cleanupErrors.push(`Failed to delete thread ${thread!.id}: ${_error}`);
    }

    try {
      await openai.beta.assistants.delete(tempAssistant!.id);
    } catch (_error) {
      cleanupErrors.push(`Failed to delete assistant ${tempAssistant!.id}: ${_error}`);
    }
    
    if (cleanupErrors.length > 0) {
      // PRODUCTION: Logging disabled
// console.warn('[enhanced-rag-search] Cleanup errors:', cleanupErrors);
    }

    return enhancedResults;
  } catch (_error) {
    // PRODUCTION: Logging disabled
// console.error('[enhanced-rag-search] Search error:', _error);

    // Attempt cleanup on error
    if (tempAssistant?.id) {
      await openai.beta.assistants.delete(tempAssistant.id).catch(_err => {
        // PRODUCTION: Logging disabled
        // console.warn('[enhanced-rag-search] Failed to cleanup assistant on error:', _err)
      });
    }
    if (thread?.id) {
      await openai.beta.threads.delete(thread.id).catch(_err => {
        // PRODUCTION: Logging disabled
        // console.warn('[enhanced-rag-search] Failed to cleanup thread on error:', _err)
      });
    }

    throw _error;
  }
}

/**
 * POST /api/wiki-rag-search-enhanced - HTTP handler for enhanced RAG search
 * 
 * This endpoint combines the power of OpenAI's semantic search with local
 * database enrichment to provide the most comprehensive search results.
 * 
 * Use cases:
 * - Full-text search with semantic understanding
 * - Research requiring source verification (PDF links)
 * - Context-aware search showing surrounding information
 * - Cached searches for frequently accessed topics
 * 
 * Performance characteristics:
 * - First search: 2-5 seconds (OpenAI API + DB queries)
 * - Cached search: <100ms (cache hit)
 * - Scales with number of results requested
 * 
 * Error handling:
 * - Graceful degradation if enrichment fails
 * - Always attempts to return some results
 * - Detailed logging for debugging without exposing internals
 * 
 * @param {Request} request - HTTP request with {query, maxResults}
 * @returns {Response} Enhanced search results with full metadata
 */
export async function POST(request: Request) {
  return await withRateLimit(request, wikiSearchRateLimiter, async () => {
    // Environment validation
    if (!openaiApiKey || !vectorStoreId) {
      // PRODUCTION: Logging disabled
// console.error('[enhanced-rag-search] Missing environment variables');
      return addSecurityHeaders(
        NextResponse.json(
          {
            error: 'Search service not configured',
          },
          { status: 503 }
        )
      );
    }

    // Initialize OpenAI client
    if (!openai) {
      openai = new OpenAI({ apiKey: openaiApiKey });
    }

    try {
      // Validate request
      const validation = await validateRequest(request, validationSchemas.wikiSearch, {
        body: true,
        sanitize: true,
      });

      if (!validation.success) {
        return addSecurityHeaders(
          NextResponse.json(
            {
              error: 'Invalid request',
              details: validation.details,
            },
            { status: 400 }
          )
        );
      }

      const { query, maxResults = 10 } = validation.data;

      if (query.length < 3) {
        return addSecurityHeaders(
          NextResponse.json(
            {
              error: 'Search query must be at least 3 characters long',
            },
            { status: 400 }
          )
        );
      }

      // Perform enhanced RAG search
      const results = await performEnhancedRagSearch(
        openai,
        vectorStoreId,
        query,
        Math.min(maxResults, 20)
      );

      return addSecurityHeaders(
        NextResponse.json(
          {
            success: true,
            searchType: 'enhanced-rag',
            results,
            query: query.substring(0, 200),
            maxResults,
            timestamp: new Date().toISOString(),
          },
          { status: 200 }
        )
      );
    } catch (_error) {
      // PRODUCTION: Logging disabled
// console.error('[enhanced-rag-search] Error:', _error);

      return addSecurityHeaders(
        NextResponse.json(
          {
            error: 'Enhanced search temporarily unavailable',
          },
          { status: 500 }
        )
      );
    }
  });
}

export async function OPTIONS() {
  return addSecurityHeaders(
    new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin':
          process.env.NODE_ENV === 'development' ? '*' : 'https://erisdebate.com',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Max-Age': '86400',
      },
    })
  );
}