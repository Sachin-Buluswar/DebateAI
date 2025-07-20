/**
 * DebateAI - Wiki RAG Generation API Endpoint
 * Receives a query, retrieves relevant context from the Vector Store,
 * and generates a synthesized answer using an LLM.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { withRateLimit, wikiSearchRateLimiter } from '@/middleware/rateLimiter';
import { validateRequest, validationSchemas, addSecurityHeaders } from '@/middleware/inputValidation';
import { openAIManager } from '@/backend/services/openaiClientManager';
import { apiLogger as logger } from '@/lib/monitoring/logger';
import {
  searchVectorStore,
  SearchResult,
} from '@/backend/modules/wikiSearch/retrievalService';
import {
  generateAnswerFromContext,
  GeneratedAnswer,
} from '@/backend/modules/wikiSearch/generationService';

// Get environment variables
const vectorStoreId = process.env.OPENAI_VECTOR_STORE_ID;
const generationModel = process.env.OPENAI_GENERATION_MODEL || 'gpt-4o-mini';

/**
 * POST handler for generating an answer using RAG.
 * Expects a JSON body with { query: string, maxResults?: number }.
 */
export async function POST(request: NextRequest) {
  // Apply rate limiting with handler function
  const result = await withRateLimit(request, wikiSearchRateLimiter, async () => {
    try {
      // Authentication check
      const cookieStore = cookies();
      const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
      
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      if (authError || !user) {
        return addSecurityHeaders(
          NextResponse.json({ error: 'Authentication required' }, { status: 401 })
        );
      }
      
      // Environment variable check
      if (!vectorStoreId) {
        logger.error('OPENAI_VECTOR_STORE_ID environment variable is not set');
        return addSecurityHeaders(
          NextResponse.json({ error: 'Server configuration error: Vector Store ID missing' }, { status: 500 })
        );
      }

      // Validate request body
      const validation = await validateRequest(request, validationSchemas.wikiGenerate, { sanitize: true });
      
      if (!validation.success) {
        return addSecurityHeaders(
          NextResponse.json({ 
            error: 'Invalid request data', 
            details: validation.details || validation.error
          }, { status: 400 })
        );
      }

      const { query, maxResults, context } = validation.data;
      
      logger.info('Processing wiki generation request', {
        userId: user.id,
        metadata: {
          query: query.substring(0, 50) + '...',
          maxResults
        }
      });

      // Get OpenAI client from pool
      const openai = await openAIManager.getRawClient();
      
      // Step 1: Use provided context or retrieve from vector store
      let contextChunks: SearchResult[];
      
      if (context && context.length > 0) {
        // Use provided context (for cases where search was done separately)
        contextChunks = context.map((ctx, idx) => ({
          content: ctx.content,
          source: ctx.source || `Context ${idx + 1}`,
          score: ctx.relevance || 0.8
        }));
        logger.info('Using provided context', { metadata: { contextCount: context.length } });
      } else {
        // Retrieve context chunks from vector store
        contextChunks = await searchVectorStore(
          openai,
          vectorStoreId,
          query,
          maxResults
        );
        logger.info('Retrieved context from vector store', { 
          metadata: { chunksFound: contextChunks.length }
        });
      }

      // Step 2: Generate answer from context
      const generatedResult: GeneratedAnswer = await generateAnswerFromContext(
        null, // Pass null to use centralized service
        generationModel,
        query,
        contextChunks
      );
      
      logger.info('Wiki generation completed', {
        userId: user.id,
        metadata: {
          answerLength: generatedResult.answer.length,
          sourcesCount: generatedResult.sources.length
        }
      });

      // Return generated answer
      return addSecurityHeaders(
        NextResponse.json({
          success: true,
          ...generatedResult
        })
      );

    } catch (error) {
      logger.error('Wiki generation failed', error as Error, {
        userId: 'unknown'
      });
      
      if (error instanceof SyntaxError) {
        return addSecurityHeaders(
          NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
        );
      }
      
      // Check for specific errors from underlying services
      if (error instanceof Error) {
        if (error.message.includes('Failed to perform search') || error.message.includes('Assistant run failed')) {
          return addSecurityHeaders(
            NextResponse.json({ 
              error: 'Search service temporarily unavailable',
              message: 'Unable to search the knowledge base. Please try again in a moment.'
            }, { status: 503 })
          );
        }
        if (error.message.includes('Failed to generate answer')) {
          return addSecurityHeaders(
            NextResponse.json({ 
              error: 'Generation service temporarily unavailable',
              message: 'Unable to generate an answer. Please try again in a moment.'
            }, { status: 503 })
          );
        }
      }
      
      // Generic server error
      return addSecurityHeaders(
        NextResponse.json({ 
          error: 'Internal server error',
          message: 'An unexpected error occurred. Please try again later.'
        }, { status: 500 })
      );
    }
  });
  
  return result;
} 