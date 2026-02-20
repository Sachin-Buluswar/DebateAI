import { NextRequest, NextResponse } from 'next/server';
import { DocumentStorageService } from '@/backend/services/documentStorageService';
import { EnhancedIndexingService } from '@/backend/services/enhancedIndexingService';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { withRateLimit, apiRateLimiter } from '@/middleware/rateLimiter';
import { addSecurityHeaders } from '@/middleware/inputValidation';
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

        // Get document
        const document = await documentStorage.getDocument(documentId);
        if (!document) {
          return NextResponse.json({ error: 'Document not found' }, { status: 404 });
        }

        // Delete existing chunks (needs service role for bulk delete)
        const serviceClient = createServiceClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!
        );
        await serviceClient
          .from('document_chunks')
          .delete()
          .eq('document_id', documentId);

        // Re-index document
        await indexingService.indexPDFDocument(document.id, document.file_url, document.file_name);

        return addSecurityHeaders(
          NextResponse.json({
            success: true,
            message: 'Document reindexed successfully',
          })
        );
      } catch (_error) {
        // PRODUCTION: Logging disabled
        // console.error('Error reindexing document:', _error);
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