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
import { wikiSearchRateLimiter, withRateLimit } from '@/api-middleware/rateLimiter';
import {
  validateRequest,
  validationSchemas,
  addSecurityHeaders,
} from '@/api-middleware/inputValidation';
import { createClient } from '@/lib/supabase/server';
import { EnhancedSearchResult } from '@/types/documents';
import { optionalAuth } from '@/lib/auth-middleware';
import { SupabaseClient } from '@supabase/supabase-js';

interface SearchChunk {
  id: string;
  document_id: string;
  content: string;
  page_number: number | null;
  section_title: string | null;
  chunk_index: number;
}

/**
 * Score a chunk's relevance to the query. Rewards exact phrase match,
 * presence of all terms, and term frequency. Returns 0-1.
 */
function scoreChunk(chunk: SearchChunk, query: string, terms: string[]): number {
  const content = chunk.content.toLowerCase();
  const queryLower = query.toLowerCase();

  let score = 0;
  // Exact phrase match (highest weight)
  if (content.includes(queryLower)) score += 15;

  // Count how many distinct terms appear (AND-like boost)
  let termsPresent = 0;
  for (const term of terms) {
    const count = (content.match(new RegExp(term, 'gi')) || []).length;
    if (count > 0) {
      termsPresent++;
      score += Math.min(count, 5) * 2; // Cap per-term frequency bonus
    }
  }
  // Bonus for having all terms present
  if (terms.length > 1 && termsPresent === terms.length) score += 10;

  return Math.min(1.0, score / 40);
}

/**
 * performDirectDocumentSearch - Database-based document search
 *
 * Uses ILIKE with PostgreSQL's trigram GIN index (gin_trgm_ops) for consistently
 * fast search (~500ms) across 170K+ chunks. Results are scored and ranked
 * client-side by term frequency and exact match presence.
 */
async function performDirectDocumentSearch(
  supabase: SupabaseClient,
  query: string,
  maxResults: number = 10
): Promise<EnhancedSearchResult[]> {
  const searchTerms = query
    .toLowerCase()
    .split(/\s+/)
    .filter((term) => term.length > 2);
  if (searchTerms.length === 0) return [];

  // Use ILIKE with OR conditions, backed by the content_trgm GIN index.
  // Fetch extra candidates so client-side AND-filtering + scoring has enough to work with.
  const fetchLimit = maxResults * 5;
  const orConditions = searchTerms.map((term) => `content.ilike.%${term}%`).join(',');

  const { data: chunks, error: searchError } = await supabase
    .from('document_chunks')
    .select('id, content, page_number, section_title, chunk_index, document_id')
    .or(orConditions)
    .limit(fetchLimit);

  if (searchError) {
    throw new Error(`Document search failed: ${searchError.message}`);
  }

  if (!chunks || chunks.length === 0) return [];

  // Score, rank, and take top results. scoreChunk rewards all-terms-present.
  const scored = (chunks as SearchChunk[])
    .map((chunk) => ({ chunk, score: scoreChunk(chunk, query, searchTerms) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults);

  // Fetch document metadata for all results in a single query
  const docIds = [...new Set(scored.map((s) => s.chunk.document_id))];
  const { data: documents } = await supabase
    .from('documents')
    .select('id, title, file_name, file_url, source_type, indexed_at')
    .in('id', docIds);

  const docMap = new Map(documents?.map((d) => [d.id, d]) ?? []);

  // Batch-fetch context chunks in a single query
  const contextConditions = scored
    .map(
      (s) =>
        `and(document_id.eq.${s.chunk.document_id},chunk_index.gte.${Math.max(0, s.chunk.chunk_index - 2)},chunk_index.lte.${s.chunk.chunk_index + 2})`
    )
    .join(',');

  const { data: allContextChunks } = await supabase
    .from('document_chunks')
    .select('document_id, chunk_index, content')
    .or(contextConditions)
    .order('chunk_index', { ascending: true });

  const contextMap = new Map<string, Array<{ chunk_index: number; content: string }>>();
  for (const ctx of allContextChunks ?? []) {
    if (!contextMap.has(ctx.document_id)) contextMap.set(ctx.document_id, []);
    contextMap.get(ctx.document_id)!.push(ctx);
  }

  // Transform to EnhancedSearchResult format
  return scored.map(({ chunk, score }) => {
    const doc = docMap.get(chunk.document_id);
    const docCtx = contextMap.get(chunk.document_id) ?? [];
    const beforeChunks = docCtx.filter((c) => c.chunk_index < chunk.chunk_index);
    const afterChunks = docCtx.filter((c) => c.chunk_index > chunk.chunk_index);
    const pdfPageAnchor = chunk.page_number ? `#page=${chunk.page_number}` : '';

    return {
      content: chunk.content,
      source: doc?.file_name ?? 'Unknown',
      score,
      chunk_id: chunk.id,
      document_id: chunk.document_id,
      page_number: chunk.page_number ?? undefined,
      pdf_url: doc?.file_url ?? '',
      pdf_page_anchor: pdfPageAnchor,
      context: {
        before: beforeChunks.map((c) => c.content).join('\n\n'),
        after: afterChunks.map((c) => c.content).join('\n\n'),
      },
      metadata: {
        title: doc?.title ?? 'Untitled',
        section: chunk.section_title ?? undefined,
        source_type: doc?.source_type ?? 'unknown',
        indexed_at: doc?.indexed_at ?? undefined,
      },
    };
  });
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
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return addSecurityHeaders(
          NextResponse.json(
            {
              error: 'Search failed. Please try again later.',
              details: process.env.NODE_ENV === 'development' ? message : undefined,
            },
            { status: 500 }
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
          process.env.NODE_ENV === 'development'
            ? '*'
            : process.env.NEXT_PUBLIC_APP_URL || 'https://erisdebate.com',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Max-Age': '86400',
      },
    })
  );
}
