import { NextRequest, NextResponse } from 'next/server';
import { OpenAI } from 'openai';
import { wikiSearchRateLimiter, withRateLimit } from '@/api-middleware/rateLimiter';
import {
  validateRequest,
  validationSchemas,
  addSecurityHeaders,
} from '@/api-middleware/inputValidation';
import { optionalAuth } from '@/lib/auth-middleware';
import { createClient } from '@/lib/supabase/server';

const openaiApiKey = process.env.OPENAI_API_KEY;

let openai: OpenAI | null = null;

interface VectorResult {
  id: string;
  document_id: string;
  content: string;
  page_number: number | null;
  section_title: string | null;
  chunk_index: number;
  similarity: number;
}

export async function POST(request: NextRequest) {
  const rateLimitResult = await withRateLimit(request, wikiSearchRateLimiter, async () => {
    return optionalAuth(request, async () => {
      if (!openaiApiKey) {
        return addSecurityHeaders(
          NextResponse.json(
            {
              error: 'Server configuration error: Search service unavailable.',
            },
            { status: 503 }
          )
        );
      }

      if (!openai) {
        openai = new OpenAI({ apiKey: openaiApiKey });
      }

      try {
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

        const { query, maxResults = 5 } = validation.data;

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

        // Generate query embedding
        const embeddingResponse = await openai.embeddings.create({
          model: 'text-embedding-3-small',
          input: query,
        });
        const queryEmbedding = embeddingResponse.data[0].embedding;

        // Vector search via RPC using authenticated client
        const supabase = createClient();
        const { data: vectorResults, error: rpcError } = await supabase.rpc(
          'match_document_chunks',
          {
            query_embedding: JSON.stringify(queryEmbedding),
            match_threshold: 0.3,
            match_count: Math.min(maxResults, 20),
          }
        );

        if (rpcError) {
          throw new Error(`Search RPC failed: ${rpcError.message}`);
        }

        const chunks = (vectorResults ?? []) as VectorResult[];

        // Fetch document metadata
        const docIds = [...new Set(chunks.map((c) => c.document_id))];
        const { data: documents } =
          docIds.length > 0
            ? await supabase
                .from('documents')
                .select('id, title, file_name, file_url, source_type, indexed_at')
                .in('id', docIds)
            : { data: [] };

        const docMap = new Map(documents?.map((d) => [d.id, d]) ?? []);

        const results = chunks.map((chunk) => {
          const doc = docMap.get(chunk.document_id);
          return {
            content: chunk.content,
            source: doc?.file_name ?? 'Unknown',
            score: chunk.similarity,
            chunk_id: chunk.id,
            document_id: chunk.document_id,
            page_number: chunk.page_number ?? undefined,
            pdf_url: doc?.file_url ?? '',
            pdf_page_anchor: chunk.page_number ? `#page=${chunk.page_number}` : '',
            context: { before: '', after: '' },
            metadata: {
              title: doc?.title ?? 'Unknown',
              section: chunk.section_title ?? undefined,
              source_type: doc?.source_type ?? 'other',
              indexed_at: doc?.indexed_at ?? undefined,
            },
          };
        });

        return addSecurityHeaders(
          NextResponse.json(
            {
              success: true,
              results,
              query: query.substring(0, 200),
              maxResults,
              timestamp: new Date().toISOString(),
              cached: false,
            },
            { status: 200 }
          )
        );
      } catch (_error) {
        return addSecurityHeaders(
          NextResponse.json(
            {
              error: 'Search temporarily unavailable. Please try again later.',
            },
            { status: 500 }
          )
        );
      }
    });
  });

  if (rateLimitResult instanceof Response) {
    return addSecurityHeaders(rateLimitResult);
  }

  return rateLimitResult;
}

export async function OPTIONS() {
  return addSecurityHeaders(
    new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin':
          process.env.NODE_ENV === 'development'
            ? '*'
            : process.env.NEXT_PUBLIC_APP_URL || 'https://erisdebate.com',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Max-Age': '86400',
      },
    })
  );
}
