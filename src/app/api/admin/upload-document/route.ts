import { NextRequest, NextResponse } from 'next/server';
import { DocumentStorageService } from '@/server/services/documentStorageService';
import { EnhancedIndexingService } from '@/server/services/enhancedIndexingService';
import { withRateLimit, apiRateLimiter } from '@/api-middleware/rateLimiter';
import { addSecurityHeaders } from '@/api-middleware/inputValidation';
import { requireAdmin, AuthenticatedRequest } from '@/lib/auth-middleware';

export async function POST(request: NextRequest): Promise<NextResponse | Response> {
  return await withRateLimit(request, apiRateLimiter, async () => {
    return requireAdmin(request, async (_authenticatedReq: AuthenticatedRequest) => {
      try {
        const formData = await request.formData();
        const file = formData.get('file') as File;

        if (!file) {
          return NextResponse.json({ error: 'No file provided' }, { status: 400 });
        }

        const isPDF = file.name.endsWith('.pdf');
        const isTXT = file.name.endsWith('.txt');

        if (!isPDF && !isTXT) {
          return NextResponse.json(
            { error: 'Invalid file type. Only PDF and TXT files are supported.' },
            { status: 400 }
          );
        }

        const documentStorage = new DocumentStorageService();
        const indexingService = new EnhancedIndexingService();

        // Upload file to Supabase Storage
        const fileBuffer = Buffer.from(await file.arrayBuffer());
        const { url: fileUrl } = await documentStorage.uploadPDF(fileBuffer, file.name);

        // Extract text from file
        let text = '';
        if (isPDF) {
          const pdfParse = await import('pdf-parse').then((m) => m.default || m);
          const pdfData = await pdfParse(fileBuffer);
          text = pdfData.text;
        } else {
          text = new TextDecoder().decode(fileBuffer);
        }

        // Create document record
        const document = await documentStorage.createDocument(
          file.name.replace(/\.(pdf|txt)$/i, ''),
          file.name,
          fileUrl,
          file.size,
          undefined,
          undefined,
          'upload'
        );

        // Index document: chunk, embed, store
        if (text.trim().length > 50) {
          await indexingService.indexDocument(document.id, text, file.name);
        }

        return addSecurityHeaders(
          NextResponse.json({
            success: true,
            documentId: document.id,
            fileName: file.name,
          })
        );
      } catch (_error) {
        return addSecurityHeaders(
          NextResponse.json({ error: 'Failed to upload document' }, { status: 500 })
        );
      }
    });
  });
}
