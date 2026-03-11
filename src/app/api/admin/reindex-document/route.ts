import { NextRequest, NextResponse } from 'next/server';
import { DocumentStorageService } from '@/server/services/documentStorageService';
import { EnhancedIndexingService } from '@/server/services/enhancedIndexingService';
import { supabaseAdmin } from '@/server/lib/supabaseAdmin';
import { withRateLimit, apiRateLimiter } from '@/api-middleware/rateLimiter';
import { addSecurityHeaders } from '@/api-middleware/inputValidation';
import { requireAdmin, AuthenticatedRequest } from '@/lib/auth-middleware';

export async function POST(request: NextRequest): Promise<NextResponse | Response> {
  return await withRateLimit(request, apiRateLimiter, async () => {
    return requireAdmin(request, async (_authenticatedReq: AuthenticatedRequest) => {
      try {
        const { documentId } = await request.json();

        if (!documentId) {
          return NextResponse.json({ error: 'Document ID required' }, { status: 400 });
        }

        const documentStorage = new DocumentStorageService();
        const indexingService = new EnhancedIndexingService();

        const document = await documentStorage.getDocument(documentId);
        if (!document) {
          return NextResponse.json({ error: 'Document not found' }, { status: 404 });
        }

        // Delete existing chunks
        await supabaseAdmin
          .from('document_chunks')
          .delete()
          .eq('document_id', documentId);

        // Re-extract text if we have a file URL, otherwise use stored content
        let text = '';
        if (document.file_url && document.file_url.length > 0) {
          try {
            const response = await fetch(document.file_url);
            if (response.ok) {
              const buffer = Buffer.from(await response.arrayBuffer());
              if (document.file_name.endsWith('.pdf')) {
                const pdfParse = await import('pdf-parse').then(m => m.default || m);
                const pdfData = await pdfParse(buffer);
                text = pdfData.text;
              } else {
                text = new TextDecoder().decode(buffer);
              }
            }
          } catch {
            // Fall back to stored content
          }
        }

        // Fall back to stored content preview
        if (!text && document.content) {
          text = document.content;
        }

        if (!text || text.trim().length < 50) {
          return addSecurityHeaders(
            NextResponse.json(
              { error: 'No content available for reindexing' },
              { status: 400 }
            )
          );
        }

        await indexingService.indexDocument(document.id, text, document.file_name);

        return addSecurityHeaders(
          NextResponse.json({
            success: true,
            message: 'Document reindexed successfully',
          })
        );
      } catch (_error) {
        return addSecurityHeaders(
          NextResponse.json(
            { error: 'Failed to reindex document' },
            { status: 500 }
          )
        );
      }
    });
  });
}
