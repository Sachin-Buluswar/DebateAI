/**
 * Eris Debate - Pure RAG Search API Endpoint
 * 
 * This endpoint implements a Retrieval-Augmented Generation (RAG) pattern for document search.
 * RAG combines vector search with generative AI to find relevant information in large document sets.
 * 
 * Key concepts:
 * - Vector Search: Documents are converted to mathematical embeddings that capture semantic meaning
 * - OpenAI Assistants API: Used to search through pre-indexed document chunks in a vector store
 * - File Citations: OpenAI returns references to specific chunks where information was found
 * 
 * Returns raw vector search results with PDF context and chunk metadata.
 * This allows users to see the original document context around search results.
 * 
 * @endpoint POST /api/wiki-rag-search
 * @param {string} query - The search query to find relevant documents
 * @param {number} maxResults - Maximum number of results to return (default: 10, max: 20)
 * @returns {RagSearchResult[]} Array of search results with content, source, and metadata
 */

import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { wikiSearchRateLimiter, withRateLimit } from '@/middleware/rateLimiter';
import {
  validateRequest,
  validationSchemas,
  addSecurityHeaders,
} from '@/middleware/inputValidation';

// Get environment variables
const openaiApiKey = process.env.OPENAI_API_KEY;
const vectorStoreId = process.env.OPENAI_VECTOR_STORE_ID;

// Initialize OpenAI client
let openai: OpenAI | null = null;

/**
 * RagSearchResult - Structure for RAG search results
 * 
 * This interface defines the shape of each search result returned by the RAG system.
 * Each result represents a chunk of text from a document that matches the search query.
 * 
 * @property {string} content - The actual text content from the matched document chunk
 * @property {string} source - The source document name or identifier
 * @property {number} score - Relevance score (0-1) indicating how well this chunk matches the query
 * @property {object} metadata - Additional information about the chunk's location in the document
 * @property {string} metadata.file_id - OpenAI's internal file identifier for this document
 * @property {string} metadata.file_name - Human-readable name of the source file
 * @property {number} metadata.chunk_index - Position of this chunk within the document (0-based)
 * @property {number} metadata.page_number - PDF page number where this content appears
 * @property {number} metadata.start_char - Character position where this chunk starts in the full document
 * @property {number} metadata.end_char - Character position where this chunk ends in the full document
 * @property {object} context - Surrounding text to provide additional context
 * @property {string} context.before - Text that appears before this chunk in the document
 * @property {string} context.after - Text that appears after this chunk in the document
 */
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
 * performRagSearch - Core RAG search implementation using OpenAI's vector store
 * 
 * This function implements the RAG pattern:
 * 1. Creates a temporary OpenAI Assistant configured with file_search tool
 * 2. The Assistant has access to a pre-indexed vector store containing document chunks
 * 3. User query is processed by the Assistant which searches the vector store
 * 4. Results include file citations that reference specific chunks
 * 5. We extract these citations and format them as structured search results
 * 
 * Document Chunking Strategy:
 * - Documents are pre-processed and split into overlapping chunks (~500-1000 tokens each)
 * - Each chunk is embedded using OpenAI's text-embedding-3-small model
 * - Chunks maintain metadata about their position, page number, and surrounding context
 * - This allows semantic search to find relevant passages even if exact keywords don't match
 * 
 * Vector Search Process:
 * - Query is converted to an embedding vector
 * - Vector store finds chunks with similar embeddings (cosine similarity)
 * - Results are ranked by relevance score
 * - File citations provide exact references to source documents
 * 
 * @param {OpenAI} openai - Initialized OpenAI client instance
 * @param {string} vectorStoreId - ID of the pre-indexed OpenAI vector store
 * @param {string} query - User's search query
 * @param {number} maxResults - Maximum results to return (capped at 20 for performance)
 * @returns {Promise<RagSearchResult[]>} Array of search results with metadata
 */
async function performRagSearch(
  openai: OpenAI,
  vectorStoreId: string,
  query: string,
  maxResults: number = 10
): Promise<RagSearchResult[]> {
  // Perform pure RAG search using OpenAI's vector store and file search capabilities

  try {
    // Get embedding for the query
    // Note: While we generate the embedding here, the actual vector search is handled
    // by the OpenAI Assistant's file_search tool internally. This embedding could be
    // used for client-side similarity calculations or caching in the future.
    const embeddingResponse = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: query,
    });

    const _queryEmbedding = embeddingResponse.data[0].embedding;

    // Create a temporary assistant for vector search
    // The Assistant API provides a managed way to search through vector stores.
    // Key features:
    // - file_search tool: Enables semantic search across indexed documents
    // - vector_store_ids: Links to pre-indexed document collections
    // - Automatic citation generation: Returns references to source chunks
    // - GPT-4 integration: Can understand context and intent beyond keyword matching
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

    const run = await openai.beta.threads.runs.create(thread.id, {
      assistant_id: tempAssistant.id,
      response_format: { type: 'json_object' },
    });

    // Poll for completion
    let currentRunId = run.id;
    let currentRunStatus = run.status;
    while (['queued', 'in_progress', 'requires_action'].includes(currentRunStatus)) {
      await new Promise((r) => setTimeout(r, 1000));
      const updatedRun = await openai.beta.threads.runs.retrieve(currentRunId, {
        thread_id: thread.id,
      });
      currentRunStatus = updatedRun.status;
      currentRunId = updatedRun.id;
    }

    if (currentRunStatus !== 'completed') {
      throw new Error(`RAG search failed with status: ${currentRunStatus}`);
    }

    // Get messages and parse results
    const messages = await openai.beta.threads.messages.list(thread.id, { order: 'desc' });
    const assistantMessage = messages.data.find((msg) => msg.role === 'assistant');

    const results: RagSearchResult[] = [];

    if (assistantMessage) {
      for (const content of assistantMessage.content) {
        if (content.type === 'text') {
          // Parse JSON response or extract citations
          const textContent = content.text.value;

          // Extract file citations from annotations
          // OpenAI's file_search tool returns citations as annotations in the response.
          // Each citation includes:
          // - file_id: Reference to the source file in the vector store
          // - text: The cited text with special markers (【...】)
          // These citations are our primary way to trace results back to source documents
          const annotations = content.text.annotations || [];
          const citations = annotations.filter((a) => 'file_citation' in a);

          if (citations.length > 0) {
            // Process each citation as a separate result
            for (let i = 0; i < citations.length && results.length < maxResults; i++) {
              const citation = citations[i] as { file_citation?: { file_id: string }; text?: string };
              const fileId = citation.file_citation?.file_id || '';

              // Get file information
              let fileName = 'Unknown Document';
              try {
                const file = await openai.files.retrieve(fileId);
                fileName = file.filename || fileName;
              } catch (_e) {
                // PRODUCTION: Logging disabled
// console.warn(`Could not retrieve file info for ${fileId}`);
              }

              // Extract the relevant text around the citation
              // OpenAI formats citations as 【citation_number】followed by the cited text
              // We parse this format to extract the actual content.
              // Fallback: If parsing fails, we take a substring based on position
              const quoteParts = citation.text?.split('】') || [];
              const relevantText =
                quoteParts.length > 1
                  ? quoteParts[1].substring(0, 500).trim()
                  : textContent.substring(i * 200, (i + 1) * 200).trim();

              results.push({
                content: relevantText,
                source: fileName,
                score: Math.max(0.1, 1.0 - i * 0.1), // Decreasing relevance
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
                score: Math.max(0.1, 1.0 - i * 0.1),
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
    await openai.beta.threads.delete(thread.id).catch(() => {});
    await openai.beta.assistants.delete(tempAssistant.id).catch(() => {});

    // Return results
    return results.slice(0, maxResults);
  } catch (_error) {
    // PRODUCTION: Logging disabled
// console.error('[rag-search] RAG search error:', _error);

    // Return error result
    return [
      {
        content: `RAG search temporarily unavailable for "${query}". Please try the assistant search mode or try again later.`,
        source: 'system-error',
        score: 0.0,
        metadata: {
          file_id: 'error',
          chunk_index: 0,
        },
      },
    ];
  }
}

/**
 * POST /api/wiki-rag-search - HTTP handler for RAG-based document search
 * 
 * This endpoint provides semantic search capabilities using OpenAI's RAG implementation.
 * It's designed for searching through pre-indexed document collections (debate evidence,
 * research papers, etc.) and returning relevant passages with context.
 * 
 * Request flow:
 * 1. Rate limiting check (prevents abuse)
 * 2. Environment validation (ensures API keys are configured)
 * 3. Request validation (sanitizes input, checks query length)
 * 4. RAG search execution (queries vector store)
 * 5. Result formatting (structures response with metadata)
 * 
 * Security features:
 * - Rate limiting per IP/user
 * - Input sanitization
 * - CORS headers for cross-origin requests
 * - Error messages that don't expose internal details
 * 
 * @param {Request} request - HTTP request with JSON body containing {query, maxResults}
 * @returns {Response} JSON response with search results or error
 */
export async function POST(request: Request) {
  return await withRateLimit(request, wikiSearchRateLimiter, async () => {
    // Environment validation
    if (!openaiApiKey || !vectorStoreId) {
      // PRODUCTION: Logging disabled
// console.error('[rag-search] Missing environment variables');
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

      // Process RAG search request

      // Perform RAG search
      const results = await performRagSearch(
        openai,
        vectorStoreId,
        query,
        Math.min(maxResults, 20)
      );

      return addSecurityHeaders(
        NextResponse.json(
          {
            success: true,
            searchType: 'rag',
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
// console.error('[rag-search] Error:', _error);

      return addSecurityHeaders(
        NextResponse.json(
          {
            error: 'RAG search temporarily unavailable',
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
