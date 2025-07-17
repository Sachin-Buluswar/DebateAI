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

    // Delete existing chunks
    await supabase
      .from('document_chunks')
      .delete()
      .eq('document_id', documentId);

    // Re-index document
    await indexingService.indexPDFDocument(document.id, document.file_url, document.file_name);

    return NextResponse.json({
      success: true,
      message: 'Document reindexed successfully',
    });
  } catch (error) {
    console.error('Error reindexing document:', error);
    return NextResponse.json(
      { error: 'Failed to reindex document' },
      { status: 500 }
    );
  }
}