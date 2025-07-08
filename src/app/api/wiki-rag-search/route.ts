/**
 * DebateAI - Pure RAG Search API Endpoint
 * Returns raw vector search results with PDF context and chunk metadata.
 * This allows users to see the original document context around search results.
 */

import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { wikiSearchRateLimiter, withRateLimit } from '@/middleware/rateLimiter';
import { validateRequest, validationSchemas, addSecurityHeaders } from '@/middleware/inputValidation';

// Get environment variables
const openaiApiKey = process.env.OPENAI_API_KEY;
const vectorStoreId = process.env.OPENAI_VECTOR_STORE_ID;

// Initialize OpenAI client
let openai: OpenAI | null = null;

export interface RagSearchResult {
  content: string;
  source: string;
  score: number;
  metadata: {
    file_id: string;
    file_name?: string;
    chunk_index?: number;
    page_number?: number;
    start_char?: number;
    end_char?: number;
  };
  context?: {
    before?: string;
    after?: string;
  };
}

/**
 * Pure RAG search using OpenAI embeddings and vector store
 */
async function performRagSearch(
  openai: OpenAI,
  vectorStoreId: string,
  query: string,
  maxResults: number = 10
): Promise<RagSearchResult[]> {
  console.log(`[rag-search] Performing pure RAG search for: "${query}"`);

  try {
    // Get embedding for the query
    const embeddingResponse = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: query,
    });

    const queryEmbedding = embeddingResponse.data[0].embedding;

    // Create a temporary assistant for vector search
    const tempAssistant = await openai.beta.assistants.create({
      name: 'RAG Search Assistant',
      instructions: `You are a document search assistant. For each query, return the most relevant document chunks in JSON format. Include exact text content, source information, and relevance scores.

Response format:
{
  "results": [
    {
      "content": "exact text from document",
      "source": "document name",
      "relevance": 0.95,
      "file_id": "file_xxx",
      "metadata": {}
    }
  ]
}

Return up to ${maxResults} results ordered by relevance.`,
      model: 'gpt-4o',
      tools: [{ type: 'file_search' }],
      tool_resources: {
        file_search: {
          vector_store_ids: [vectorStoreId],
        },
      },
    });

    // Create thread and run search
    const thread = await openai.beta.threads.create();

    await openai.beta.threads.messages.create(thread.id, {
      role: 'user',
      content: `Search for information about: "${query}". Return detailed document chunks with metadata.`,
    });

    let run = await openai.beta.threads.runs.create(thread.id, {
      assistant_id: tempAssistant.id,
      response_format: { type: 'json_object' },
    });

    // Poll for completion
    while (['queued', 'in_progress', 'requires_action'].includes(run.status)) {
      await new Promise(r => setTimeout(r, 1000));
      run = await openai.beta.threads.runs.retrieve(thread.id, run.id);
    }

    if (run.status !== 'completed') {
      throw new Error(`RAG search failed with status: ${run.status}`);
    }

    // Get messages and parse results
    const messages = await openai.beta.threads.messages.list(thread.id, { order: 'desc' });
    const assistantMessage = messages.data.find(msg => msg.role === 'assistant');

    let results: RagSearchResult[] = [];

    if (assistantMessage) {
      for (const content of assistantMessage.content) {
        if (content.type === 'text') {
          // Parse JSON response or extract citations
          const textContent = content.text.value;
          
          // Extract file citations from annotations
          const annotations = content.text.annotations || [];
          const citations = annotations.filter(a => 'file_citation' in a);

          if (citations.length > 0) {
            // Process each citation as a separate result
            for (let i = 0; i < citations.length && results.length < maxResults; i++) {
              const citation = citations[i] as any;
              const fileId = citation.file_citation?.file_id;
              
              // Get file information
              let fileName = 'Unknown Document';
              try {
                const file = await openai.files.retrieve(fileId);
                fileName = file.filename || fileName;
              } catch (e) {
                console.warn(`Could not retrieve file info for ${fileId}`);
              }

              // Extract the relevant text around the citation
              const quoteParts = citation.text?.split('】') || [];
              const relevantText = quoteParts.length > 1 
                ? quoteParts[1].substring(0, 500).trim()
                : textContent.substring(i * 200, (i + 1) * 200).trim();

              results.push({
                content: relevantText,
                source: fileName,
                score: Math.max(0.1, 1.0 - (i * 0.1)), // Decreasing relevance
                metadata: {
                  file_id: fileId,
                  file_name: fileName,
                  chunk_index: i,
                },
              });
            }
          } else {
            // Fallback: split text into chunks
            const chunks = textContent.match(/.{1,300}(?:\s|$)/g) || [textContent];
            
            for (let i = 0; i < Math.min(chunks.length, maxResults); i++) {
              results.push({
                content: chunks[i].trim(),
                source: 'Vector Store Search',
                score: Math.max(0.1, 1.0 - (i * 0.1)),
                metadata: {
                  file_id: 'unknown',
                  chunk_index: i,
                },
              });
            }
          }
        }
      }
    }

    // Cleanup
    await openai.beta.threads.del(thread.id).catch(() => {});
    await openai.beta.assistants.del(tempAssistant.id).catch(() => {});

    console.log(`[rag-search] Found ${results.length} RAG results`);
    return results.slice(0, maxResults);

  } catch (error) {
    console.error('[rag-search] RAG search error:', error);
    
    // Return error result
    return [{
      content: `RAG search temporarily unavailable for "${query}". Please try the assistant search mode or try again later.`,
      source: 'system-error',
      score: 0.0,
      metadata: {
        file_id: 'error',
        chunk_index: 0,
      },
    }];
  }
}

/**
 * POST handler for pure RAG search
 */
export async function POST(request: Request) {
  return await withRateLimit(request, wikiSearchRateLimiter, async () => {
    // Environment validation
    if (!openaiApiKey || !vectorStoreId) {
      return addSecurityHeaders(
        NextResponse.json({
          error: 'Search service not configured'
        }, { status: 503 })
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
          NextResponse.json({
            error: 'Invalid request',
            details: validation.details
          }, { status: 400 })
        );
      }

      const { query, maxResults = 10 } = validation.data;

      if (query.length < 3) {
        return addSecurityHeaders(
          NextResponse.json({
            error: 'Search query must be at least 3 characters long'
          }, { status: 400 })
        );
      }

      console.log(`[rag-search] Processing RAG search: "${query.substring(0, 50)}..."`);

      // Perform RAG search
      const results = await performRagSearch(
        openai,
        vectorStoreId,
        query,
        Math.min(maxResults, 20)
      );

      return addSecurityHeaders(
        NextResponse.json({
          success: true,
          searchType: 'rag',
          results,
          query: query.substring(0, 200),
          maxResults,
          timestamp: new Date().toISOString(),
        }, { status: 200 })
      );

    } catch (error) {
      console.error('[rag-search] Error:', error);
      
      return addSecurityHeaders(
        NextResponse.json({
          error: 'RAG search temporarily unavailable'
        }, { status: 500 })
      );
    }
  });
}

export async function OPTIONS() {
  return addSecurityHeaders(
    new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': process.env.NODE_ENV === 'development' ? '*' : 'https://debateai.com',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Max-Age': '86400',
      },
    })
  );
}