import { createClient } from '@supabase/supabase-js';
import { Document, DocumentChunk } from '@/types/documents';
import crypto from 'crypto';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export class DocumentStorageService {
  private bucketName = 'debate-documents';

  async uploadPDF(file: File | Buffer, fileName: string, metadata?: any): Promise<{ url: string; path: string }> {
    try {
      const fileBuffer = file instanceof File ? Buffer.from(await file.arrayBuffer()) : file;
      const fileHash = crypto.createHash('md5').update(fileBuffer).digest('hex');
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const safeName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
      const path = `${timestamp}_${fileHash}_${safeName}`;

      const { data, error } = await supabase.storage
        .from(this.bucketName)
        .upload(path, fileBuffer, {
          contentType: 'application/pdf',
          cacheControl: '3600',
          upsert: false
        });

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage
        .from(this.bucketName)
        .getPublicUrl(path);

      return { url: publicUrl, path };
    } catch (error) {
      console.error('Error uploading PDF:', error);
      throw error;
    }
  }

  async createDocument(
    title: string,
    fileName: string,
    fileUrl: string,
    fileSize?: number,
    pageCount?: number,
    sourceUrl?: string,
    sourceType: 'upload' | 'opencaselist' | 'other' = 'upload',
    metadata?: any
  ): Promise<Document> {
    const { data, error } = await supabase
      .from('documents')
      .insert({
        title,
        file_name: fileName,
        file_url: fileUrl,
        file_size: fileSize,
        page_count: pageCount,
        source_url: sourceUrl,
        source_type: sourceType,
        metadata: metadata || {},
        indexed_at: null
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async createDocumentChunks(chunks: Omit<DocumentChunk, 'id' | 'created_at'>[]): Promise<DocumentChunk[]> {
    const { data, error } = await supabase
      .from('document_chunks')
      .insert(chunks)
      .select();

    if (error) throw error;
    return data;
  }

  async getDocument(documentId: string): Promise<Document | null> {
    const { data, error } = await supabase
      .from('documents')
      .select()
      .eq('id', documentId)
      .single();

    if (error) return null;
    return data;
  }

  async getDocumentChunks(documentId: string, pageNumber?: number): Promise<DocumentChunk[]> {
    let query = supabase
      .from('document_chunks')
      .select()
      .eq('document_id', documentId)
      .order('chunk_index', { ascending: true });

    if (pageNumber !== undefined) {
      query = query.eq('page_number', pageNumber);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  }

  async getChunkByOpenAIFileId(openaiFileId: string): Promise<DocumentChunk | null> {
    const { data, error } = await supabase
      .from('document_chunks')
      .select()
      .eq('openai_file_id', openaiFileId)
      .single();

    if (error) return null;
    return data;
  }

  async getChunkWithContext(chunkId: string, contextSize: number = 2): Promise<{
    chunk: DocumentChunk;
    before: DocumentChunk[];
    after: DocumentChunk[];
    document: Document;
  } | null> {
    const { data: chunk, error: chunkError } = await supabase
      .from('document_chunks')
      .select()
      .eq('id', chunkId)
      .single();

    if (chunkError || !chunk) return null;

    const { data: document, error: docError } = await supabase
      .from('documents')
      .select()
      .eq('id', chunk.document_id)
      .single();

    if (docError || !document) return null;

    const { data: beforeChunks } = await supabase
      .from('document_chunks')
      .select()
      .eq('document_id', chunk.document_id)
      .lt('chunk_index', chunk.chunk_index)
      .order('chunk_index', { ascending: false })
      .limit(contextSize);

    const { data: afterChunks } = await supabase
      .from('document_chunks')
      .select()
      .eq('document_id', chunk.document_id)
      .gt('chunk_index', chunk.chunk_index)
      .order('chunk_index', { ascending: true })
      .limit(contextSize);

    return {
      chunk,
      before: beforeChunks?.reverse() || [],
      after: afterChunks || [],
      document
    };
  }

  async updateDocumentIndexStatus(documentId: string): Promise<void> {
    await supabase
      .from('documents')
      .update({ indexed_at: new Date().toISOString() })
      .eq('id', documentId);
  }

  async searchDocuments(query: string): Promise<Document[]> {
    // Sanitize the query to prevent SQL injection
    const sanitizedQuery = query.replace(/[%_]/g, '\\$&');
    
    const { data, error } = await supabase
      .from('documents')
      .select()
      .or(`title.ilike.%${sanitizedQuery}%,file_name.ilike.%${sanitizedQuery}%`)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  async deleteDocument(documentId: string): Promise<void> {
    const document = await this.getDocument(documentId);
    if (!document) return;

    // Delete from storage
    if (document.file_url) {
      const path = document.file_url.split('/').pop();
      if (path) {
        await supabase.storage
          .from(this.bucketName)
          .remove([path]);
      }
    }

    // Delete from database (chunks will cascade delete)
    await supabase
      .from('documents')
      .delete()
      .eq('id', documentId);
  }

  async getSearchResultsCache(queryHash: string): Promise<any | null> {
    const { data, error } = await supabase
      .from('search_results_cache')
      .select()
      .eq('query_hash', queryHash)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (error || !data) return null;
    return data.results;
  }

  async setSearchResultsCache(queryText: string, results: any): Promise<void> {
    const queryHash = crypto.createHash('md5').update(queryText).digest('hex');
    
    await supabase
      .from('search_results_cache')
      .upsert({
        query_hash: queryHash,
        query_text: queryText,
        results,
        expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString() // 1 hour
      });
  }
}