/**
 * DebateAI - Wiki RAG Generation API Endpoint
 * Receives a query, retrieves relevant context from the Vector Store,
 * and generates a synthesized answer using an LLM.
 */

import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import {
  searchVectorStore,
  SearchResult,
} from '@/backend/modules/wikiSearch/retrievalService';
import {
  generateAnswerFromContext,
  GeneratedAnswer,
} from '@/backend/modules/wikiSearch/generationService';

// Get environment variables
const openaiApiKey = process.env.OPENAI_API_KEY;
const vectorStoreId = process.env.OPENAI_VECTOR_STORE_ID;
const generationModel = process.env.OPENAI_GENERATION_MODEL || 'gpt-4o'; // Allow configuring the model

// Initialize OpenAI client - moved inside handler
let openai: OpenAI | null = null;

/**
 * POST handler for generating an answer using RAG.
 * Expects a JSON body with { query: string, maxResults?: number }.
 */
export async function POST(request: Request) {
  // --- Authentication Check ---
  const cookieStore = cookies();
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
  
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  
  if (authError || !user) {
    return NextResponse.json({ 
      error: 'Authentication required' 
    }, { status: 401 });
  }
  
  // --- Environment Variable Check ---
  if (!openaiApiKey) {
    console.error('OPENAI_API_KEY environment variable is not set.');
    return NextResponse.json({ error: 'Server configuration error: OpenAI API key missing.' }, { status: 500 });
  }
  if (!vectorStoreId) {
    console.error('OPENAI_VECTOR_STORE_ID environment variable is not set.');
    return NextResponse.json({ error: 'Server configuration error: OpenAI Vector Store ID missing.' }, { status: 500 });
  }

  // --- Initialize OpenAI Client (if not already) ---
  if (!openai) {
      openai = new OpenAI({ apiKey: openaiApiKey });
  }

  try {
    // --- Request Body Parsing and Validation ---
    const body = await request.json();
    const { query, maxResults } = body;

    if (!query || typeof query !== 'string') {
      return NextResponse.json({ error: 'Invalid request body. Required field: query (string).' }, { status: 400 });
    }
    // Validate optional maxResults for retrieval step
    if (maxResults !== undefined && (typeof maxResults !== 'number' || !Number.isInteger(maxResults) || maxResults <= 0)) {
      return NextResponse.json({ error: 'Invalid request body. Optional field maxResults must be a positive integer.' }, { status: 400 });
    }

    // Process RAG generation request

    // --- Step 1: Retrieve Context Chunks ---
    const contextChunks: SearchResult[] = await searchVectorStore(
        openai,
        vectorStoreId,
        query,
        maxResults // Pass optional maxResults or undefined (defaults in retrievalService)
    );

    // --- Step 2: Generate Answer from Context ---
    const generatedResult: GeneratedAnswer = await generateAnswerFromContext(
        openai,
        generationModel, // Use the configured generation model
        query,
        contextChunks
    );

    // --- Return Generated Answer --- 
    return NextResponse.json(generatedResult, { status: 200 });

  } catch (error) {
    // --- General Error Handling ---
    console.error('Error in wiki-generate POST handler:', error);
    if (error instanceof SyntaxError) {
        return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
    }
    // Check for errors from underlying services
    if (error instanceof Error) {
        if (error.message.includes('Failed to perform search') || error.message.includes('Assistant run failed')) {
            return NextResponse.json({ error: `RAG failed during retrieval step: ${error.message}` }, { status: 500 });
        }
        if (error.message.includes('Failed to generate answer')) {
            return NextResponse.json({ error: `RAG failed during generation step: ${error.message}` }, { status: 500 });
        }
    }
    // Generic server error
    return NextResponse.json({ error: 'Internal Server Error during RAG generation.' }, { status: 500 });
  }
} 