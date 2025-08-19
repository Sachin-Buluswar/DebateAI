import { NextRequest, NextResponse } from 'next/server';
import { DocumentStorageService } from '@/backend/services/documentStorageService';
import { EnhancedIndexingService } from '@/backend/services/enhancedIndexingService';
import { createClient } from '@/utils/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { withRateLimit, apiRateLimiter } from '@/middleware/rateLimiter';
import { addSecurityHeaders } from '@/middleware/inputValidation';

export async function POST(request: NextRequest): Promise<NextResponse | Response> {
  // Apply rate limiting for file uploads to prevent DOS attacks
  return await withRateLimit(request, apiRateLimiter, async () => {
    try {
      // Check authentication using server client
      const supabase = createClient();
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      if (authError || !user) {
        return addSecurityHeaders(
          NextResponse.json(
            { error: 'Unauthorized - Please log in' },
            { status: 401 }
          )
        );
      }

      // Check if user has admin role in user_roles table
      const { data: userRole, error: roleError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .single();
      
      if (roleError || !userRole || (userRole.role !== 'admin' && userRole.role !== 'super_admin')) {
        return addSecurityHeaders(
          NextResponse.json(
            { error: 'Forbidden - Admin access required' },
            { status: 403 }
          )
        );
      }

    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const isPDF = file.name.endsWith('.pdf');
    const isTXT = file.name.endsWith('.txt');
    
    if (!isPDF && !isTXT) {
      return NextResponse.json({ error: 'Invalid file type. Only PDF and TXT files are supported.' }, { status: 400 });
    }

    const documentStorage = new DocumentStorageService();
    const indexingService = new EnhancedIndexingService();

    // Upload file to Supabase Storage
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const { url: fileUrl } = await documentStorage.uploadPDF(fileBuffer, file.name);

    // Create document record
    const document = await documentStorage.createDocument(
      file.name.replace(/\.(pdf|txt)$/i, ''),
      file.name,
      fileUrl,
      file.size,
      undefined, // Page count will be determined during indexing
      undefined,
      'upload'
    );

    if (isPDF) {
      // Start PDF indexing process
      await indexingService.indexPDFDocument(document.id, fileUrl, file.name);
    } else if (isTXT) {
      // For text files, create chunks directly
      const textContent = new TextDecoder().decode(fileBuffer);
      const chunks = textContent
        .split('\n\n')
        .filter(chunk => chunk.trim().length > 50)
        .map((content, index) => ({
          document_id: document.id,
          chunk_index: index,
          content: content.trim(),
          page_number: 1,
          metadata: {}
        }));
        
      if (chunks.length > 0) {
        // Use service client only for storage operations
        const serviceClient = createServiceClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!
        );
        await serviceClient
          .from('document_chunks')
          .insert(chunks);
      }
      
      // Mark as indexed
      await documentStorage.updateDocumentIndexStatus(document.id);
    }

      return addSecurityHeaders(
        NextResponse.json({
          success: true,
          documentId: document.id,
          fileName: file.name,
        })
      );
    } catch (error) {
      // PRODUCTION: Logging disabled
// console.error('Error uploading document:', error);
      return addSecurityHeaders(
        NextResponse.json(
          { error: 'Failed to upload document' },
          { status: 500 }
        )
      );
    }
  });
}