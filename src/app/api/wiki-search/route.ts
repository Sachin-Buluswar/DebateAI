/**
 * Wiki Search API Endpoint
 *
 * Uses OpenAI's vector store for semantic document search.
 *
 * @endpoint POST /api/wiki-search
 */

import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import {
  enhancedSearchVectorStore,
  EnhancedSearchResult,
} from '@/backend/modules/wikiSearch/enhancedRetrievalService';
import { wikiSearchRateLimiter, withRateLimit } from '@/middleware/rateLimiter';
import { validateRequest, validationSchemas, addSecurityHeaders } from '@/middleware/inputValidation';
import { optionalAuth } from '@/lib/auth-middleware';

// Get environment variables
const openaiApiKey = process.env.OPENAI_API_KEY;
const vectorStoreId = process.env.OPENAI_VECTOR_STORE_ID;

// Lazy initialization pattern for OpenAI client
let openai: OpenAI | null = null;

export async function POST(request: NextRequest) {
  // Apply rate limiting
  const rateLimitResult = await withRateLimit(request, wikiSearchRateLimiter, async () => {
    return optionalAuth(request, async () => {
    // Environment Variable Check
    if (!openaiApiKey) {
      return addSecurityHeaders(
        NextResponse.json({
          error: 'Server configuration error: Search service unavailable.'
        }, { status: 503 })
      );
    }
    if (!vectorStoreId) {
      return addSecurityHeaders(
        NextResponse.json({
          error: 'The search service is not configured. Please contact support.'
        }, { status: 503 })
      );
    }

    // Initialize OpenAI Client
    if (!openai) {
      openai = new OpenAI({ apiKey: openaiApiKey });
    }

    try {
      // Validate and sanitize input
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

      const { query, maxResults = 5 } = validation.data;

      // Additional business logic validation
      if (query.length < 3) {
        return addSecurityHeaders(
          NextResponse.json({
            error: 'Search query must be at least 3 characters long'
          }, { status: 400 })
        );
      }

      // Perform search using enhanced vector store retrieval
      const results: EnhancedSearchResult[] = await enhancedSearchVectorStore(
        openai,
        vectorStoreId,
        query,
        Math.min(maxResults, 20)
      );

      return addSecurityHeaders(
        NextResponse.json({
          success: true,
          results,
          query: query.substring(0, 200),
          maxResults,
          timestamp: new Date().toISOString(),
          cached: false,
        }, { status: 200 })
      );

    } catch (error) {
      // Return appropriate error based on error type
      if (error instanceof Error) {
        if (error.message.includes('Rate limit') || error.message.includes('quota')) {
          return addSecurityHeaders(
            NextResponse.json({
              error: 'Service temporarily overloaded. Please try again in a few minutes.'
            }, { status: 503 })
          );
        }

        if (error.message.includes('Authentication') || error.message.includes('API key')) {
          return addSecurityHeaders(
            NextResponse.json({
              error: 'Search service configuration error. Please contact support.'
            }, { status: 503 })
          );
        }
      }

      // Generic server error (don't expose internal details)
      return addSecurityHeaders(
        NextResponse.json({
          error: 'Search temporarily unavailable. Please try again later.'
        }, { status: 500 })
      );
    }
    });
  });

  // Return rate limit response if blocked
  if (rateLimitResult instanceof Response) {
    return addSecurityHeaders(rateLimitResult);
  }

  return rateLimitResult;
}

// Handle OPTIONS for CORS
export async function OPTIONS() {
  return addSecurityHeaders(
    new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': process.env.NODE_ENV === 'development' ? '*' : (process.env.NEXT_PUBLIC_APP_URL || 'https://erisdebate.com'),
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Max-Age': '86400',
      },
    })
  );
}
