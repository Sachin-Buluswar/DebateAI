/**
 * DebateAI - Wiki Index API Endpoint
 * Processes debate documents and adds them to OpenAI Vector Storage for later retrieval
 */

import { NextResponse } from 'next/server';
import { OpenAI } from 'openai';
import { createClient } from '@/utils/supabase/server';
import { processAndIndexDocument } from '@/backend/modules/wikiSearch/indexingService';

// Get environment variables
const openaiApiKey = process.env.OPENAI_API_KEY;
const vectorStoreId = process.env.OPENAI_VECTOR_STORE_ID;
// const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
// const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Initialize OpenAI client - moved inside handler to check for API key first
let openai: OpenAI | null = null;

// Initialize Supabase admin client (Optional: for server operations like logging/auth checks)
// const supabaseAdmin = createClient(supabaseUrl || '', supabaseServiceKey || '');

/**
 * POST handler for indexing a single document.
 * Expects a JSON body with { fileName: string, fileContent: string }.
 */
export async function POST(request: Request) {
  // --- Authentication Check ---
  const supabase = createClient();
  
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  
  if (authError || !user) {
    return NextResponse.json({ 
      error: 'Authentication required' 
    }, { status: 401 });
  }
  
  // Optional: Add admin-only check
  // const { data: profile } = await supabase
  //   .from('user_profiles')
  //   .select('role')
  //   .eq('id', user.id)
  //   .single();
  //   
  // if (profile?.role !== 'admin') {
  //   return NextResponse.json({ 
  //     error: 'Admin access required' 
  //   }, { status: 403 });
  // }
  
  // Environment variables are checked below

  let requestBodyForErrorLog: unknown = null; // Variable to hold body for logging in catch block
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
  // Lazily initialize to avoid creating instance if keys are missing
  if (!openai) {
      openai = new OpenAI({ apiKey: openaiApiKey });
  }

  try {
    // --- Request Body Parsing and Validation ---
    const body = await request.json();
    requestBodyForErrorLog = body; // Store body for potential use in catch block
    const { fileName, fileContent } = body;

    if (!fileName || typeof fileName !== 'string' || !fileContent || typeof fileContent !== 'string') {
      return NextResponse.json({ error: 'Invalid request body. Required fields: fileName (string), fileContent (string).' }, { status: 400 });
    }

    // Process document indexing request

    // --- Synchronous Processing Call (for debugging) ---
    // Process and index the document
    await processAndIndexDocument(openai, vectorStoreId, fileContent, fileName);

    // Return success response only if processAndIndexDocument completes without throwing
    return NextResponse.json({ message: `Successfully initiated and awaited indexing for ${fileName}.` }, { status: 200 });
    // ----------------------------------------------------

  } catch (error) {
    // --- Error Handling --- 
    // Log the filename if available from the parsed body
    const failedFileName = (requestBodyForErrorLog as { fileName?: string })?.fileName || 'unknown'; 
    console.error(`[API /wiki-index] Error processing request for file ${failedFileName}:`, error);

    // Handle specific errors thrown from the service layer
    if (error instanceof Error) {
         // Log the specific error message from the service
         console.error(`[API /wiki-index] Service Error Message: ${error.message}`);
         // Return a specific error response based on the caught error
         return NextResponse.json({ error: `Indexing failed for ${failedFileName}: ${error.message}` }, { status: 500 });
    } else if (error instanceof SyntaxError) {
        // Specific handling for JSON parsing errors
        return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
    }
    // Generic server error for other unexpected issues
    return NextResponse.json({ error: `Internal Server Error during indexing process for ${failedFileName}` }, { status: 500 });
  }
} 