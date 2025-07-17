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

    const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (!user || (user.email !== 'admin@debateai.com' && user.email !== 'claudecode@gmail.com')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file || !file.name.endsWith('.pdf')) {
      return NextResponse.json({ error: 'Invalid file. Only PDFs are supported.' }, { status: 400 });
    }

    const documentStorage = new DocumentStorageService();
    const indexingService = new EnhancedIndexingService();

    // Upload PDF to Supabase Storage
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const { url: fileUrl } = await documentStorage.uploadPDF(fileBuffer, file.name);

    // Create document record
    const document = await documentStorage.createDocument(
      file.name.replace('.pdf', ''),
      file.name,
      fileUrl,
      file.size,
      undefined, // Page count will be determined during indexing
      undefined,
      'upload'
    );

    // Start indexing process
    await indexingService.indexPDFDocument(document.id, fileUrl, file.name);

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