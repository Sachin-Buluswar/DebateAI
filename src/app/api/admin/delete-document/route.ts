/**
 * Admin endpoint to delete a document and its associated data.
 * Removes document record, chunks, and storage file.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, AuthenticatedRequest } from '@/lib/auth-middleware';
import { supabaseAdmin as supabase } from '@/backend/lib/supabaseAdmin';
import { z } from 'zod';

const deleteSchema = z.object({
  documentId: z.string().uuid('Invalid document ID'),
});

export async function DELETE(request: NextRequest) {
  return requireAdmin(request, async (_authenticatedRequest: AuthenticatedRequest) => {
    try {
      const body = await request.json();
      const parsed = deleteSchema.safeParse(body);

      if (!parsed.success) {
        return NextResponse.json(
          { error: 'Invalid request data', details: parsed.error.errors },
          { status: 400 }
        );
      }

      const { documentId } = parsed.data;

      // Fetch the document first to get file info
      const { data: document, error: fetchError } = await supabase
        .from('documents')
        .select('id, file_url, file_name')
        .eq('id', documentId)
        .single();

      if (fetchError || !document) {
        return NextResponse.json(
          { error: 'Document not found' },
          { status: 404 }
        );
      }

      // Delete document chunks first (in case cascade isn't set up)
      await supabase
        .from('document_chunks')
        .delete()
        .eq('document_id', documentId);

      // Delete from storage if file URL exists
      if (document.file_url) {
        const path = document.file_url.split('/').pop();
        if (path) {
          await supabase.storage
            .from('debate-documents')
            .remove([path]);
        }
      }

      // Delete the document record
      const { error: deleteError } = await supabase
        .from('documents')
        .delete()
        .eq('id', documentId);

      if (deleteError) {
        return NextResponse.json(
          { error: 'Failed to delete document' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: `Document ${document.file_name} deleted successfully`,
      });
    } catch (error) {
      if (error instanceof SyntaxError) {
        return NextResponse.json(
          { error: 'Invalid JSON body' },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
  });
}
