/**
 * Eris Debate - Wiki Search API Endpoint
 * 
 * Primary search endpoint that uses OpenAI's vector store for semantic document search.
 * This is the main search interface for the debate application, providing intelligent
 * document retrieval based on meaning rather than just keywords.
 * 
 * Architecture Overview:
 * - Uses OpenAI's Assistants API with file_search tool
 * - Documents are pre-processed and stored in OpenAI's vector store
 * - Each document is chunked, embedded, and indexed for semantic search
 * - Results include relevance scores and document metadata
 * 
 * Security & Production Features:
 * - Authentication required (Supabase session)
 * - Rate limiting to prevent abuse
 * - Input validation and sanitization
 * - Comprehensive error handling
 * - Security headers on all responses
 * 
 * This endpoint integrates with enhancedRetrievalService for result processing.
 * 
 * @endpoint POST /api/wiki-search
 * @param {string} query - Search query (min 3 characters)
 * @param {number} maxResults - Max results to return (default: 5, max: 20)
 * @returns {EnhancedSearchResult[]} Semantic search results with metadata
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
// Lazy initialization pattern: Client is created on first request
// This avoids initialization errors if environment variables are not set
// and allows for dynamic configuration updates
let openai: OpenAI | null = null;

/**
 * POST /api/wiki-search - Main search endpoint for document retrieval
 * 
 * Request Flow:
 * 1. Rate Limiting: Prevents abuse using per-IP/user limits
 * 2. Authentication: Verifies user has valid Supabase session
 * 3. Environment Check: Ensures OpenAI credentials are configured
 * 4. Input Validation: Sanitizes query and validates parameters
 * 5. Search Execution: Calls enhancedSearchVectorStore for semantic search
 * 6. Result Processing: Formats and returns results with metadata
 * 
 * The endpoint uses a multi-layered security approach:
 * - Rate limiting (prevents DoS)
 * - Authentication (ensures authorized access)
 * - Input validation (prevents injection attacks)
 * - Error sanitization (avoids information leakage)
 * 
 * Performance considerations:
 * - Results are capped at 20 to prevent long response times
 * - Future enhancement: Implement result caching for common queries
 * 
 * @param {Request} request - HTTP request with search parameters
 * @returns {Response} JSON response with search results or error
 */
export async function POST(request: Request) {
  // Apply rate limiting
  const rateLimitResult = await withRateLimit(request, wikiSearchRateLimiter, async () => {
    // Check authentication
    // Uses Supabase for session management
    // This ensures only authenticated users can search documents
    // Important for:
    // - Preventing unauthorized access to debate materials
    // - Tracking usage per user for rate limiting
    // - Audit logging for security compliance
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

      // Perform Search using enhanced vector store retrieval
      // This function (from enhancedRetrievalService) handles:
      // - Query embedding generation
      // - Vector similarity search in OpenAI's store
      // - Result ranking and relevance scoring
      // - Metadata enrichment (page numbers, sources, etc.)
      // 
      // The vector search process:
      // 1. Query → Embedding (dense vector representation)
      // 2. Find similar document chunk embeddings
      // 3. Rank by cosine similarity score
      // 4. Return top K results with metadata
      const results: EnhancedSearchResult[] = await enhancedSearchVectorStore(
        openai,
        vectorStoreId,
        query,
        Math.min(maxResults, 20) // Cap at 20 results for performance
      );

      console.log(`[wiki-search] Search completed. Returning ${results.length} results.`);

      // Return Results with security headers
      // Response format is standardized across all search endpoints
      // for consistent client-side handling
      // 
      // Response fields:
      // - success: Indicates successful search execution
      // - results: Array of EnhancedSearchResult objects
      // - query: Echo back truncated query for client confirmation
      // - maxResults: Actual max results used (after capping)
      // - timestamp: Server timestamp for cache invalidation
      // - cached: False (caching planned for future optimization)
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

// Handle OPTIONS for CORS (Cross-Origin Resource Sharing)
// Required for browser security when API is called from different domains
// 
// CORS Configuration:
// - Development: Allows all origins (*) for local testing
// - Production: Restricts to erisdebate.com for security
// - Allowed methods: POST (for search), OPTIONS (for preflight)
// - Allowed headers: Content-Type (JSON), Authorization (auth tokens)
// - Max-Age: 86400 seconds (24 hours) - browsers can cache preflight
export async function OPTIONS() {
  return addSecurityHeaders(
    new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': process.env.NODE_ENV === 'development' ? '*' : 'https://erisdebate.com',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Max-Age': '86400',
      },
    })
  );
} 