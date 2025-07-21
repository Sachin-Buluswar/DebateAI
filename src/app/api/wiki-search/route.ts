/**
 * DebateAI - Wiki Search API Endpoint
 * Receives a query and returns relevant document chunks from the OpenAI Vector Store.
 * Production-ready with rate limiting, input validation, and security features.
 */

import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import {
  enhancedSearchVectorStore,
  EnhancedSearchResult,
} from '@/backend/modules/wikiSearch/enhancedRetrievalService';
import { wikiSearchRateLimiter, withRateLimit } from '@/middleware/rateLimiter';
import { validateRequest, validationSchemas, addSecurityHeaders } from '@/middleware/inputValidation';
import { createClient } from '@/utils/supabase/server';

// Get environment variables
const openaiApiKey = process.env.OPENAI_API_KEY;
const vectorStoreId = process.env.OPENAI_VECTOR_STORE_ID;

// Initialize OpenAI client - moved inside handler
let openai: OpenAI | null = null;

/**
 * POST handler for searching the wiki vector store.
 * Production-ready with rate limiting, input validation, and security features.
 */
export async function POST(request: Request) {
  // Apply rate limiting
  const rateLimitResult = await withRateLimit(request, wikiSearchRateLimiter, async () => {
    // Check authentication
    const supabase = createClient();
    
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      console.warn('[wiki-search] Unauthorized request - no session');
      return addSecurityHeaders(
        NextResponse.json({ 
          error: 'Authentication required' 
        }, { status: 401 })
      );
    }
    
    // Environment Variable Check
    if (!openaiApiKey) {
      console.error('[wiki-search] OPENAI_API_KEY environment variable is not set.');
      return addSecurityHeaders(
        NextResponse.json({ 
          error: 'Server configuration error: Search service unavailable.' 
        }, { status: 503 })
      );
    }
    if (!vectorStoreId) {
      console.error('[wiki-search] OPENAI_VECTOR_STORE_ID environment variable is not set.');
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
        console.warn('[wiki-search] Invalid request:', validation.error);
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

      console.log(`[wiki-search] Processing search request: "${query.substring(0, 50)}..."`);

      // Perform Search
      const results: EnhancedSearchResult[] = await enhancedSearchVectorStore(
        openai,
        vectorStoreId,
        query,
        Math.min(maxResults, 20) // Cap at 20 results for performance
      );

      console.log(`[wiki-search] Search completed. Returning ${results.length} results.`);

      // Return Results with security headers
      return addSecurityHeaders(
        NextResponse.json({
          success: true,
          results,
          query: query.substring(0, 200), // Limit echoed query length
          maxResults,
          timestamp: new Date().toISOString(),
          cached: false, // Future: implement caching
        }, { status: 200 })
      );

    } catch (error) {
      console.error('[wiki-search] Search error:', error);
      
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
        'Access-Control-Allow-Origin': process.env.NODE_ENV === 'development' ? '*' : 'https://debateai.com',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Max-Age': '86400',
      },
    })
  );
} 