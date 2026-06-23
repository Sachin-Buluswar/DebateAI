import { NextRequest, NextResponse } from 'next/server';
import { optionalAuth } from '@/lib/auth-middleware';
import { User } from '@supabase/supabase-js';
import { withRateLimit, wikiSearchRateLimiter } from '@/api-middleware/rateLimiter';
import {
  validateRequest,
  validationSchemas,
  addSecurityHeaders,
} from '@/api-middleware/inputValidation';
import { apiLogger as logger } from '@/lib/monitoring/logger';
import {
  generateAnswerFromContext,
  GeneratedAnswer,
} from '@/server/modules/wikiSearch/generationService';
import { SearchResult } from '@/server/modules/wikiSearch/retrievalService';
import { OpenAI } from 'openai';
import { createClient } from '@/lib/supabase/server';

const openaiApiKey = process.env.OPENAI_API_KEY;
const generationModel = process.env.OPENAI_GENERATION_MODEL || 'gpt-4o-mini';

let openai: OpenAI | null = null;

interface RpcChunkResult {
  id: string;
  document_id: string;
  content: string;
  page_number: number | null;
  section_title: string | null;
  chunk_index: number;
  similarity: number;
}

/**
 * Retrieve context chunks using pgvector similarity search.
 */
async function retrieveContext(query: string, maxResults: number): Promise<SearchResult[]> {
  if (!openai) {
    openai = new OpenAI({ apiKey: openaiApiKey! });
  }

  // Generate query embedding
  const embeddingResponse = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: query,
  });
  const queryEmbedding = embeddingResponse.data[0].embedding;

  // Call pgvector RPC
  const supabase = createClient();
  const { data: results, error } = await supabase.rpc('match_document_chunks', {
    query_embedding: JSON.stringify(queryEmbedding),
    match_threshold: 0.3,
    match_count: maxResults,
  });

  if (error) {
    throw new Error(`Search RPC failed: ${error.message}`);
  }

  const chunks = (results ?? []) as RpcChunkResult[];

  // Fetch document names for source attribution
  const docIds = [...new Set(chunks.map((c) => c.document_id))];
  const { data: documents } =
    docIds.length > 0
      ? await supabase.from('documents').select('id, file_name').in('id', docIds)
      : { data: [] };
  const docMap = new Map(documents?.map((d) => [d.id, d.file_name]) ?? []);

  return chunks.map((chunk) => ({
    content: chunk.content,
    source: docMap.get(chunk.document_id) ?? 'Unknown',
    score: chunk.similarity,
  }));
}

export async function POST(request: NextRequest) {
  const result = await withRateLimit(request, wikiSearchRateLimiter, async () => {
    return optionalAuth(request, async (req) => {
      try {
        const user = (req as unknown as { user?: User }).user;

        if (!openaiApiKey) {
          logger.error('OPENAI_API_KEY environment variable is not set');
          return addSecurityHeaders(
            NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
          );
        }

        const validation = await validateRequest(request, validationSchemas.wikiGenerate, {
          body: true,
          sanitize: true,
        });

        if (!validation.success) {
          return addSecurityHeaders(
            NextResponse.json(
              {
                error: 'Invalid request data',
                details: validation.details || validation.error,
              },
              { status: 400 }
            )
          );
        }

        const { query, maxResults, context } = validation.data;

        logger.info('Processing wiki generation request', {
          userId: user?.id || 'guest',
          metadata: {
            query: query.substring(0, 50) + '...',
            maxResults,
          },
        });

        // Step 1: Use provided context or retrieve via pgvector search
        let contextChunks: SearchResult[];

        if (context && context.length > 0) {
          contextChunks = context.map(
            (ctx: { content: string; source?: string; relevance?: number }, idx: number) => ({
              content: ctx.content,
              source: ctx.source || `Context ${idx + 1}`,
              score: ctx.relevance || 0.8,
            })
          );
          logger.info('Using provided context', { metadata: { contextCount: context.length } });
        } else {
          contextChunks = await retrieveContext(query, maxResults || 5);
          logger.info('Retrieved context from pgvector', {
            metadata: { chunksFound: contextChunks.length },
          });
        }

        // Step 2: Generate answer from context
        const generatedResult: GeneratedAnswer = await generateAnswerFromContext(
          null,
          generationModel,
          query,
          contextChunks
        );

        logger.info('Wiki generation completed', {
          userId: user?.id || 'guest',
          metadata: {
            answerLength: generatedResult.answer.length,
            sourcesCount: generatedResult.sources.length,
          },
        });

        return addSecurityHeaders(
          NextResponse.json({
            success: true,
            ...generatedResult,
          })
        );
      } catch (error) {
        logger.error('Wiki generation failed', error as Error, {
          userId: 'unknown',
        });

        if (error instanceof SyntaxError) {
          return addSecurityHeaders(
            NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
          );
        }

        if (error instanceof Error) {
          if (error.message.includes('Search RPC failed')) {
            return addSecurityHeaders(
              NextResponse.json(
                {
                  error: 'Search service temporarily unavailable',
                  message: 'Unable to search the knowledge base. Please try again in a moment.',
                },
                { status: 503 }
              )
            );
          }
          if (error.message.includes('Failed to generate answer')) {
            return addSecurityHeaders(
              NextResponse.json(
                {
                  error: 'Generation service temporarily unavailable',
                  message: 'Unable to generate an answer. Please try again in a moment.',
                },
                { status: 503 }
              )
            );
          }
        }

        return addSecurityHeaders(
          NextResponse.json(
            {
              error: 'Internal server error',
              message: 'An unexpected error occurred. Please try again later.',
            },
            { status: 500 }
          )
        );
      }
    });
  });

  return result;
}
