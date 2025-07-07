/**
 * DebateAI - Wiki RAG Generation API Endpoint
 * Receives a query, retrieves relevant context from the Vector Store,
 * and generates a synthesized answer using an LLM.
 */

import { NextResponse } from 'next/server';
import OpenAI from 'openai';
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

// TODO: Implement proper authentication/authorization if needed

/**
 * POST handler for generating an answer using RAG.
 * Expects a JSON body with { query: string, maxResults?: number }.
 */
export async function POST(request: Request) {
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

    console.log(`Received RAG generation request with query: "${query}"`);

    // --- Step 1: Retrieve Context Chunks ---
    console.log('Step 1: Retrieving context chunks...');
    const contextChunks: SearchResult[] = await searchVectorStore(
        openai,
        vectorStoreId,
        query,
        maxResults // Pass optional maxResults or undefined (defaults in retrievalService)
    );
    console.log(`Retrieved ${contextChunks.length} context chunks.`);

    // --- Step 2: Generate Answer from Context ---
    console.log('Step 2: Generating answer...');
    const generatedResult: GeneratedAnswer = await generateAnswerFromContext(
        openai,
        generationModel, // Use the configured generation model
        query,
        contextChunks
    );
    console.log('Answer generation complete.');

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