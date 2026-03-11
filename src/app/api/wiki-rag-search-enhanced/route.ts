import { NextRequest, NextResponse } from 'next/server';
import { OpenAI } from 'openai';
import { wikiSearchRateLimiter, withRateLimit } from '@/api-middleware/rateLimiter';
import { optionalAuth } from '@/lib/auth-middleware';
import {
  validateRequest,
  validationSchemas,
  addSecurityHeaders,
} from '@/api-middleware/inputValidation';
import { EnhancedSearchResult } from '@/types/documents';
import { DocumentStorageService } from '@/server/services/documentStorageService';
import { createClient } from '@/lib/supabase/server';
import crypto from 'crypto';

const openaiApiKey = process.env.OPENAI_API_KEY;

let openai: OpenAI | null = null;

// Cache operations use DocumentStorageService (service role, server-side concern)
const documentStorage = new DocumentStorageService();

interface RpcChunkResult {
  id: string;
  document_id: string;
  content: string;
  page_number: number | null;
  section_title: string | null;
  chunk_index: number;
  similarity?: number;
  rank?: number;
}

async function performHybridSearch(
  openai: OpenAI,
  query: string,
  maxResults: number = 10
): Promise<EnhancedSearchResult[]> {
  // Check cache
  const cacheKey = crypto.createHash('md5').update(query).digest('hex');
  const cachedResults = await documentStorage.getSearchResultsCache(cacheKey) as EnhancedSearchResult[] | null;
  if (cachedResults) {
    return cachedResults;
  }

  // Generate query embedding
  const embeddingResponse = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: query,
  });
  const queryEmbedding = embeddingResponse.data[0].embedding;

  // Use authenticated client for search queries (respects RLS)
  const supabase = createClient();

  // Run vector search and full-text search in parallel
  const [vectorResults, ftsResults] = await Promise.all([
    supabase.rpc('match_document_chunks', {
      query_embedding: JSON.stringify(queryEmbedding),
      match_threshold: 0.3,
      match_count: maxResults,
    }),
    supabase.rpc('search_document_chunks', {
      search_query: query,
      max_results: maxResults,
    }),
  ]);

  // Merge and deduplicate results
  const seenIds = new Set<string>();
  const mergedChunks: Array<RpcChunkResult & { score: number }> = [];

  if (vectorResults.data) {
    for (const chunk of vectorResults.data as RpcChunkResult[]) {
      if (!seenIds.has(chunk.id)) {
        seenIds.add(chunk.id);
        mergedChunks.push({ ...chunk, score: chunk.similarity ?? 0.5 });
      }
    }
  }

  if (ftsResults.data) {
    for (const chunk of ftsResults.data as RpcChunkResult[]) {
      if (!seenIds.has(chunk.id)) {
        seenIds.add(chunk.id);
        const normalizedScore = Math.min(1, (chunk.rank ?? 0) / 10) * 0.8;
        mergedChunks.push({ ...chunk, score: normalizedScore });
      } else {
        const existing = mergedChunks.find(c => c.id === chunk.id);
        if (existing) {
          existing.score = Math.min(1, existing.score + 0.15);
        }
      }
    }
  }

  mergedChunks.sort((a, b) => b.score - a.score);
  const topChunks = mergedChunks.slice(0, maxResults);

  // Fetch document metadata
  const docIds = [...new Set(topChunks.map(c => c.document_id))];
  const { data: documents } = docIds.length > 0
    ? await supabase
        .from('documents')
        .select('id, title, file_name, file_url, source_type, indexed_at')
        .in('id', docIds)
    : { data: [] };

  const docMap = new Map(documents?.map(d => [d.id, d]) ?? []);

  const results: EnhancedSearchResult[] = topChunks.map(chunk => {
    const doc = docMap.get(chunk.document_id);
    const pdfPageAnchor = chunk.page_number ? `#page=${chunk.page_number}` : '';

    return {
      content: chunk.content,
      source: doc?.file_name ?? 'Unknown',
      score: chunk.score,
      chunk_id: chunk.id,
      document_id: chunk.document_id,
      page_number: chunk.page_number ?? undefined,
      pdf_url: doc?.file_url ?? '',
      pdf_page_anchor: pdfPageAnchor,
      context: {
        before: '',
        after: '',
      },
      metadata: {
        title: doc?.title ?? 'Unknown',
        section: chunk.section_title ?? undefined,
        source_type: doc?.source_type ?? 'other',
        indexed_at: doc?.indexed_at ?? undefined,
      },
    };
  });

  // Cache results (uses service role via DocumentStorageService — server-side concern)
  if (results.length > 0) {
    try {
      await documentStorage.setSearchResultsCache(query, results);
    } catch {
      // Caching is non-critical
    }
  }

  return results;
}

export async function POST(request: NextRequest) {
  return await withRateLimit(request, wikiSearchRateLimiter, async () => {
    return optionalAuth(request, async () => {
      if (!openaiApiKey) {
        return addSecurityHeaders(
          NextResponse.json(
            { error: 'Search service not configured' },
            { status: 503 }
          )
        );
      }

      if (!openai) {
        openai = new OpenAI({ apiKey: openaiApiKey });
      }

      try {
        const validation = await validateRequest(request, validationSchemas.wikiSearch, {
          body: true,
          sanitize: true,
        });

        if (!validation.success) {
          return addSecurityHeaders(
            NextResponse.json(
              { error: 'Invalid request', details: validation.details },
              { status: 400 }
            )
          );
        }

        const { query, maxResults = 10 } = validation.data;

        if (query.length < 3) {
          return addSecurityHeaders(
            NextResponse.json(
              { error: 'Search query must be at least 3 characters long' },
              { status: 400 }
            )
          );
        }

        const results = await performHybridSearch(
          openai,
          query,
          Math.min(maxResults, 20)
        );

        return addSecurityHeaders(
          NextResponse.json({
            success: true,
            searchType: 'hybrid-pgvector',
            results,
            query: query.substring(0, 200),
            maxResults,
            timestamp: new Date().toISOString(),
          })
        );
      } catch (_error) {
        return addSecurityHeaders(
          NextResponse.json(
            { error: 'Enhanced search temporarily unavailable' },
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
          process.env.NODE_ENV === 'development' ? '*' : (process.env.NEXT_PUBLIC_APP_URL || 'https://erisdebate.com'),
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Max-Age': '86400',
      },
    })
  );
}
