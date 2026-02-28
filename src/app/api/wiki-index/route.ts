/**
 * Eris Debate - Wiki Index API Endpoint
 * Processes debate documents and adds them to OpenAI Vector Storage for later retrieval.
 * Admin-only endpoint.
 */

import { NextRequest, NextResponse } from 'next/server';
import { OpenAI } from 'openai';
import { processAndIndexDocument } from '@/backend/modules/wikiSearch/indexingService';
import { withRateLimit, wikiSearchRateLimiter } from '@/middleware/rateLimiter';
import { requireAdmin, AuthenticatedRequest } from '@/lib/auth-middleware';

const openaiApiKey = process.env.OPENAI_API_KEY;
const vectorStoreId = process.env.OPENAI_VECTOR_STORE_ID;

let openai: OpenAI | null = null;

export async function POST(request: NextRequest) {
  return await withRateLimit(request, wikiSearchRateLimiter, async () => {
    return requireAdmin(request, async (_authenticatedRequest: AuthenticatedRequest) => {
      let requestBodyForErrorLog: unknown = null;

      if (!openaiApiKey) {
        return NextResponse.json({ error: 'Server configuration error: OpenAI API key missing.' }, { status: 500 });
      }
      if (!vectorStoreId) {
        return NextResponse.json({ error: 'Server configuration error: OpenAI Vector Store ID missing.' }, { status: 500 });
      }

      if (!openai) {
        openai = new OpenAI({ apiKey: openaiApiKey });
      }

      try {
        const body = await request.json();
        requestBodyForErrorLog = body;
        const { fileName, fileContent } = body;

        if (!fileName || typeof fileName !== 'string' || !fileContent || typeof fileContent !== 'string') {
          return NextResponse.json({ error: 'Invalid request body. Required fields: fileName (string), fileContent (string).' }, { status: 400 });
        }

        await processAndIndexDocument(openai, vectorStoreId, fileContent, fileName);

        return NextResponse.json({ message: `Successfully initiated and awaited indexing for ${fileName}.` }, { status: 200 });
      } catch (error) {
        const failedFileName = (requestBodyForErrorLog as { fileName?: string })?.fileName || 'unknown';

        if (error instanceof SyntaxError) {
          return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
        } else if (error instanceof Error) {
          return NextResponse.json({ error: `Indexing failed for ${failedFileName}` }, { status: 500 });
        }
        return NextResponse.json({ error: `Internal Server Error during indexing process for ${failedFileName}` }, { status: 500 });
      }
    });
  });
}
