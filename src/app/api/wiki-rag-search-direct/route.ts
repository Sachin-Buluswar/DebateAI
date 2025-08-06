/**
 * Eris Debate - Direct RAG Search API Endpoint
 * Returns search results directly from the database without using OpenAI Assistant
 */

import { NextResponse } from 'next/server';
import { wikiSearchRateLimiter, withRateLimit } from '@/middleware/rateLimiter';
import {
  validateRequest,
  validationSchemas,
  addSecurityHeaders,
} from '@/middleware/inputValidation';
import { createClient } from '@supabase/supabase-js';
import { EnhancedSearchResult } from '@/types/documents';

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Perform direct database search for RAG
 */
async function performDirectRagSearch(
  query: string,
  maxResults: number = 10
): Promise<EnhancedSearchResult[]> {
  try {
    console.log(`[direct-rag-search] Searching for: "${query}"`);
    
    // First, try to find exact or partial matches in document chunks
    // Using PostgreSQL full-text search
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
      console.error('[direct-rag-search] Database search error:', error);
      throw error;
    }
    
    if (!chunks || chunks.length === 0) {
      console.log('[direct-rag-search] No results found, falling back to ILIKE search');
      
      // Fallback to ILIKE search for broader matching
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
      const orConditions = searchTerms.map(term => `content.ilike.%${term}%`).join(',');
      if (orConditions) {
        fallbackQuery = fallbackQuery.or(orConditions);
      }
      
      const { data: fallbackChunks, error: fallbackError } = await fallbackQuery.limit(maxResults * 2);
      
      if (fallbackError) {
        console.error('[direct-rag-search] Fallback search error:', fallbackError);
        throw fallbackError;
      }
      
      chunks.push(...(fallbackChunks || []));
    }
    
    // Score and rank results based on relevance
    const scoredResults = chunks.map(chunk => {
      const content = chunk.content.toLowerCase();
      const queryLower = query.toLowerCase();
      const queryTerms = queryLower.split(' ').filter(term => term.length > 2);
      
      // Calculate relevance score
      let score = 0;
      
      // Exact match bonus
      if (content.includes(queryLower)) {
        score += 10;
      }
      
      // Term frequency scoring
      queryTerms.forEach(term => {
        const termCount = (content.match(new RegExp(term, 'gi')) || []).length;
        score += termCount * 2;
      });
      
      // Position bonus (earlier chunks in document might be more relevant)
      score += Math.max(0, 10 - chunk.chunk_index * 0.5);
      
      return { chunk, score };
    });
    
    // Sort by score and take top results
    scoredResults.sort((a, b) => b.score - a.score);
    const topResults = scoredResults.slice(0, maxResults);
    
    // Transform to EnhancedSearchResult format
    const enhancedResults: EnhancedSearchResult[] = await Promise.all(
      topResults.map(async ({ chunk, score }, index) => {
        // Get surrounding context
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
    
    console.log(`[direct-rag-search] Returning ${enhancedResults.length} results`);
    return enhancedResults;
    
  } catch (error) {
    console.error('[direct-rag-search] Search error:', error);
    throw error;
  }
}

/**
 * POST handler for direct RAG search
 */
export async function POST(request: Request) {
  return await withRateLimit(request, wikiSearchRateLimiter, async () => {
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

      // Perform direct database search
      const results = await performDirectRagSearch(
        query,
        Math.min(maxResults, 20)
      );

      // Always return results, even if empty
      return addSecurityHeaders(
        NextResponse.json(
          {
            success: true,
            searchType: 'direct-rag',
            results,
            query: query.substring(0, 200),
            maxResults,
            timestamp: new Date().toISOString(),
          },
          { status: 200 }
        )
      );
    } catch (error) {
      console.error('[direct-rag-search] Error:', error);

      // Return empty results instead of error to prevent UI issues
      return addSecurityHeaders(
        NextResponse.json(
          {
            success: true,
            searchType: 'direct-rag',
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