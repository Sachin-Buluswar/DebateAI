/**
 * Eris Debate - Enhanced RAG Search API Endpoint
 * Returns search results with PDF links, page numbers, and surrounding context
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
let openai: OpenAI | null = null;
const documentStorage = new DocumentStorageService();

/**
 * Enhanced RAG search with PDF context
 */
async function performEnhancedRagSearch(
  openai: OpenAI,
  vectorStoreId: string,
  query: string,
  maxResults: number = 10
): Promise<EnhancedSearchResult[]> {
  let tempAssistant: any;
  let thread: any;
  
  try {
    // Check cache first
    const cacheKey = crypto.createHash('md5').update(query).digest('hex');
    const cachedResults = await documentStorage.getSearchResultsCache(cacheKey);
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
            const citation = citations[i] as any;
            const openaiFileId = citation.file_citation?.file_id;

            if (!openaiFileId) continue;

            // Look up chunk metadata in our database
            const chunk = await documentStorage.getChunkByOpenAIFileId(openaiFileId);

            if (chunk) {
              // Get surrounding context
              const contextData = await documentStorage.getChunkWithContext(chunk.id);

              if (contextData) {
                const { document, before, after } = contextData;

                // Build PDF URL with page anchor
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
              } catch (e) {
                console.warn(`Could not retrieve file info for ${openaiFileId}`);
              }
            }
          }
        }
      }
    }

    // Cache results before cleanup to ensure we have data
    if (enhancedResults.length > 0) {
      try {
        await documentStorage.setSearchResultsCache(query, enhancedResults);
      } catch (cacheError) {
        console.warn('[enhanced-rag-search] Failed to cache results:', cacheError);
        // Continue - caching is not critical
      }
    }

    // Cleanup resources
    const cleanupErrors = [];
    
    try {
      await openai.beta.threads.delete(thread.id);
    } catch (error) {
      cleanupErrors.push(`Failed to delete thread ${thread.id}: ${error}`);
    }
    
    try {
      await openai.beta.assistants.delete(tempAssistant.id);
    } catch (error) {
      cleanupErrors.push(`Failed to delete assistant ${tempAssistant.id}: ${error}`);
    }
    
    if (cleanupErrors.length > 0) {
      console.warn('[enhanced-rag-search] Cleanup errors:', cleanupErrors);
    }

    return enhancedResults;
  } catch (error) {
    console.error('[enhanced-rag-search] Search error:', error);
    
    // Attempt cleanup on error
    if (tempAssistant?.id) {
      await openai.beta.assistants.delete(tempAssistant.id).catch(err => 
        console.warn('[enhanced-rag-search] Failed to cleanup assistant on error:', err)
      );
    }
    if (thread?.id) {
      await openai.beta.threads.delete(thread.id).catch(err => 
        console.warn('[enhanced-rag-search] Failed to cleanup thread on error:', err)
      );
    }
    
    throw error;
  }
}

/**
 * POST handler for enhanced RAG search
 */
export async function POST(request: Request) {
  return await withRateLimit(request, wikiSearchRateLimiter, async () => {
    // Environment validation
    if (!openaiApiKey || !vectorStoreId) {
      console.error('[enhanced-rag-search] Missing environment variables');
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
    } catch (error) {
      console.error('[enhanced-rag-search] Error:', error);

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