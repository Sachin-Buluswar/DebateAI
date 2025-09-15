import { NextRequest, NextResponse } from 'next/server';
import { DocumentStorageService } from '@/backend/services/documentStorageService';
import { EnhancedIndexingService } from '@/backend/services/enhancedIndexingService';
import { createClient } from '@/utils/supabase/server';
import { withRateLimit, apiRateLimiter } from '@/middleware/rateLimiter';
import { addSecurityHeaders } from '@/middleware/inputValidation';
import { requireAdmin, AuthenticatedRequest } from '@/lib/auth-middleware';

export async function POST(request: NextRequest): Promise<NextResponse | Response> {
  return await withRateLimit(request, apiRateLimiter, async () => {
    return requireAdmin(request, async (req: AuthenticatedRequest) => {
      try {
        // Create authenticated Supabase client that respects RLS
        const supabase = createClient();

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

        // Delete existing chunks using authenticated client
        const { error: deleteError } = await supabase
          .from('document_chunks')
          .delete()
          .eq('document_id', documentId);
        
        if (deleteError) {
          throw new Error(`Failed to delete existing chunks: ${deleteError.message}`);
        }

        // Re-index document
        await indexingService.indexPDFDocument(document.id, document.file_url, document.file_name);

        return addSecurityHeaders(
          NextResponse.json({
            success: true,
            message: 'Document reindexed successfully',
          })
        );
      } catch (error) {
        // PRODUCTION: Logging disabled
// console.error('Error reindexing document:', error);
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