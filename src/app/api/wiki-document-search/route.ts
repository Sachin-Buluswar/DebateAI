/**
 * Eris Debate - Direct Document Search API Endpoint
 * 
 * This endpoint implements database-based document search without vector embeddings.
 * It provides a complementary search method to the RAG approach, using PostgreSQL's
 * full-text search capabilities for exact and fuzzy text matching.
 * 
 * Key differences from RAG search:
 * - No vector embeddings: Uses PostgreSQL full-text search and ILIKE queries
 * - Direct database queries: Searches pre-chunked documents stored in Supabase
 * - Exact matching: Better for finding specific terms or phrases
 * - Lower latency: No API calls to OpenAI, direct database access
 * 
 * Document Storage Structure:
 * - documents table: Stores document metadata (title, URL, source type)
 * - document_chunks table: Stores text chunks with positional metadata
 * - Chunks maintain relationships for retrieving surrounding context
 * 
 * @endpoint POST /api/wiki-document-search
 * @param {string} query - Search terms to find in documents
 * @param {number} maxResults - Maximum results to return (default: 10, max: 20)
 * @returns {EnhancedSearchResult[]} Array of search results with full context
 */

import { NextRequest, NextResponse } from 'next/server';
import { wikiSearchRateLimiter, withRateLimit } from '@/middleware/rateLimiter';
import {
  validateRequest,
  validationSchemas,
  addSecurityHeaders,
} from '@/middleware/inputValidation';
import { createClient } from '@/utils/supabase/server';
import { EnhancedSearchResult } from '@/types/documents';
import { optionalAuth } from '@/lib/auth-middleware';
import { SupabaseClient } from '@supabase/supabase-js';

/**
 * performDirectDocumentSearch - Database-based document search implementation
 * 
 * Search strategy:
 * 1. PostgreSQL Full-Text Search: Primary method using ts_vector for linguistic matching
 *    - Handles stemming: "running" matches "run", "runs", etc.
 *    - Supports phrase search and boolean operators
 *    - Language-aware (configured for English)
 * 
 * 2. Fallback ILIKE Search: Secondary method for broader matching
 *    - Activated when full-text search returns no results
 *    - Case-insensitive substring matching
 *    - Useful for acronyms, technical terms, or partial words
 * 
 * 3. Relevance Scoring: Custom algorithm considering:
 *    - Exact phrase matches (highest weight)
 *    - Individual term frequency
 *    - Chunk position in document (earlier = higher relevance)
 *    - Match position within chunk
 * 
 * 4. Context Retrieval: For each result, fetches:
 *    - 2 chunks before and after for context
 *    - Maintains document structure and flow
 *    - Helps users understand the full argument or explanation
 * 
 * @param {string} query - User's search query
 * @param {number} maxResults - Maximum results to return
 * @returns {Promise<EnhancedSearchResult[]>} Scored and ranked search results
 */
async function performDirectDocumentSearch(
  supabase: SupabaseClient,
  query: string,
  maxResults: number = 10
): Promise<EnhancedSearchResult[]> {
  try {
    
    // First, try to find exact or partial matches in document chunks
    // Using PostgreSQL full-text search with ts_vector
    // 
    // PostgreSQL Full-Text Search explained:
    // - textSearch uses PostgreSQL's to_tsquery and @@ operator
    // - 'websearch' type: Parses query like a web search (handles quotes, operators)
    // - 'english' config: Uses English dictionary for stemming and stop words
    // - Inner join ensures we only get chunks from valid documents
    // 
    // We fetch 2x maxResults because we'll apply additional scoring/filtering
    const { data: chunks, error } = await supabase
      .from('document_chunks')
      .select(`
        id,
        content,
        page_number,
        section_title,
        chunk_index,
        document_id,
        documents!inner (
          id,
          title,
          file_name,
          file_url,
          source_type,
          indexed_at
        )
      `)
      .textSearch('content', query, {
        type: 'websearch',
        config: 'english'
      })
      .limit(maxResults * 2); // Get more results to filter
    
    if (error) {
      throw error;
    }
    
    if (!chunks || chunks.length === 0) {
      
      // Fallback to ILIKE search for broader matching
      // This catches cases where full-text search misses:
      // - Technical terms not in dictionary
      // - Partial words or typos
      // - Special characters or formatting
      // 
      // Strategy: Split query into terms, search for any term appearing in content
      // Filter out very short terms to avoid too many false positives
      const searchTerms = query.toLowerCase().split(' ').filter(term => term.length > 2);
      let fallbackQuery = supabase
        .from('document_chunks')
        .select(`
          id,
          content,
          page_number,
          section_title,
          chunk_index,
          document_id,
          documents!inner (
            id,
            title,
            file_name,
            file_url,
            source_type,
            indexed_at
          )
        `);
      
      // Build OR conditions for each search term
      // PostgREST syntax: .or('content.ilike.%term1%,content.ilike.%term2%')
      const orConditions = searchTerms.map(term => `content.ilike.%${term}%`).join(',');
      if (orConditions) {
        fallbackQuery = fallbackQuery.or(orConditions);
      }
      
      const { data: fallbackChunks, error: fallbackError } = await fallbackQuery.limit(maxResults * 2);
      
      if (fallbackError) {
        throw fallbackError;
      }
      
      chunks.push(...(fallbackChunks || []));
    }
    
    // Score and rank results based on relevance
    // Custom scoring algorithm to rank results by relevance to query
    // This compensates for the limitations of database-only search
    // compared to vector similarity search
    const scoredResults = chunks.map(chunk => {
      const content = chunk.content.toLowerCase();
      const queryLower = query.toLowerCase();
      const queryTerms = queryLower.split(' ').filter(term => term.length > 2);
      
      // Calculate relevance score with multiple factors:
      let score = 0;
      
      // 1. Exact match bonus (highest weight)
      // Full query appears as-is in the content
      if (content.includes(queryLower)) {
        score += 10;
      }
      
      // 2. Term frequency scoring
      // More occurrences of search terms = higher relevance
      // Each occurrence adds 2 points
      queryTerms.forEach(term => {
        const termCount = (content.match(new RegExp(term, 'gi')) || []).length;
        score += termCount * 2;
      });
      
      // 3. Position bonus (earlier chunks in document might be more relevant)
      // Assumes important information often appears early in documents
      // Diminishes by 0.5 points per chunk position
      score += Math.max(0, 10 - chunk.chunk_index * 0.5);
      
      return { chunk, score };
    });
    
    // Sort by score and take top results
    scoredResults.sort((a, b) => b.score - a.score);
    const topResults = scoredResults.slice(0, maxResults);
    
    // Transform to EnhancedSearchResult format
    const enhancedResults: EnhancedSearchResult[] = await Promise.all(
      topResults.map(async ({ chunk, score }) => {
        // Get surrounding context for better understanding
        // Retrieves 2 chunks before and after the matched chunk
        // This provides ~1000-2000 tokens of context (assuming 500 tokens per chunk)
        // Helps users understand the full argument or explanation
        // without needing to open the source document
        const { data: contextChunks } = await supabase
          .from('document_chunks')
          .select('content, chunk_index')
          .eq('document_id', chunk.document_id)
          .gte('chunk_index', Math.max(0, chunk.chunk_index - 2))
          .lte('chunk_index', chunk.chunk_index + 2)
          .order('chunk_index', { ascending: true });
        
        const beforeChunks = contextChunks?.filter(c => c.chunk_index < chunk.chunk_index) || [];
        const afterChunks = contextChunks?.filter(c => c.chunk_index > chunk.chunk_index) || [];
        
        const document = Array.isArray(chunk.documents) ? chunk.documents[0] : chunk.documents;
        const pdfPageAnchor = chunk.page_number ? `#page=${chunk.page_number}` : '';
        
        return {
          content: chunk.content,
          source: document?.file_name || 'Unknown',
          score: Math.min(1.0, score / 100), // Normalize score to 0-1
          chunk_id: chunk.id,
          document_id: document?.id || chunk.document_id,
          page_number: chunk.page_number,
          pdf_url: document?.file_url || null,
          pdf_page_anchor: pdfPageAnchor,
          context: {
            before: beforeChunks.map(c => c.content).join('\n\n'),
            after: afterChunks.map(c => c.content).join('\n\n'),
          },
          metadata: {
            title: document?.title || 'Untitled',
            section: chunk.section_title,
            source_type: document?.source_type || 'unknown',
            indexed_at: document?.indexed_at || null,
          },
        };
      })
    );
    
    return enhancedResults;
    
  } catch (_error) {
    throw _error;
  }
}

/**
 * POST /api/wiki-document-search - HTTP handler for database document search
 * 
 * This endpoint provides an alternative to vector search, using traditional
 * database querying methods. It's particularly effective for:
 * - Exact phrase matching
 * - Finding specific terms or acronyms
 * - Lower-latency searches (no external API calls)
 * - Fallback when vector search is unavailable
 * 
 * The endpoint integrates with the same document corpus as RAG search,
 * but uses different retrieval methods. Results include the same metadata
 * and context format for consistency across search types.
 * 
 * Error handling:
 * - Returns empty results rather than errors to prevent UI disruption
 * - Logs errors for debugging while maintaining service availability
 * - Gracefully handles database connection issues
 * 
 * @param {Request} request - HTTP request with JSON body {query, maxResults}
 * @returns {Response} JSON response with search results and metadata
 */
export async function POST(request: NextRequest) {
  return await withRateLimit(request, wikiSearchRateLimiter, async () => {
    return optionalAuth(request, async (req) => {
      try {
        // Create authenticated Supabase client that respects RLS
        const supabase = createClient();
        
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

        // Perform direct database search with authenticated client
        const results = await performDirectDocumentSearch(
          supabase,
          query,
          Math.min(maxResults, 20)
        );

        // Always return results, even if empty
        return addSecurityHeaders(
          NextResponse.json(
            {
              success: true,
              searchType: 'document-search',
              results,
              query: query.substring(0, 200),
              maxResults,
              timestamp: new Date().toISOString(),
              userId: req.user?.id || 'guest', // Include user ID for audit trail
            },
            { status: 200 }
          )
        );
      } catch (_error) {

        // Return empty results instead of error to prevent UI issues
        return addSecurityHeaders(
          NextResponse.json(
            {
              success: true,
              searchType: 'document-search',
              results: [],
              query: '',
              maxResults: 10,
              timestamp: new Date().toISOString(),
              error: 'Search temporarily unavailable',
            },
            { status: 200 }
          )
        );
      }
    });
  });
}

export async function OPTIONS() {
  return addSecurityHeaders(
    new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin':
          process.env.NODE_ENV === 'development' ? '*' : (process.env.NEXT_PUBLIC_APP_URL || 'https://erisdebate.com'),
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Max-Age': '86400',
      },
    })
  );
}