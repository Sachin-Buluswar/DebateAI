import { NextRequest, NextResponse } from 'next/server';
import { DocumentStorageService } from '@/backend/services/documentStorageService';
import { EnhancedIndexingService } from '@/backend/services/enhancedIndexingService';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    // Check admin authorization
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user has admin role using RBAC
    const { data: hasAdminRole } = await supabase
      .rpc('check_user_role', { required_role: 'admin' });
    
    if (!hasAdminRole) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
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
        await supabase
          .from('document_chunks')
          .insert(chunks);
      }
      
      // Mark as indexed
      await documentStorage.updateDocumentIndexStatus(document.id);
    }

    return NextResponse.json({
      success: true,
      documentId: document.id,
      fileName: file.name,
    });
  } catch (error) {
    console.error('Error uploading document:', error);
    return NextResponse.json(
      { error: 'Failed to upload document' },
      { status: 500 }
    );
  }
}