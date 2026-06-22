import { Document, DocumentChunk } from '@/types/documents';
import { supabaseAdmin as supabase } from '@/server/lib/supabaseAdmin';
import crypto from 'crypto';

export class DocumentStorageService {
  private bucketName = 'debate-documents';

  async uploadPDF(
    file: File | Buffer,
    fileName: string,
    _metadata?: Record<string, unknown>
  ): Promise<{ url: string; path: string }> {
    try {
      const fileBuffer = file instanceof File ? Buffer.from(await file.arrayBuffer()) : file;
      const fileHash = crypto.createHash('md5').update(fileBuffer).digest('hex');
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const safeName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
      const path = `${timestamp}_${fileHash}_${safeName}`;

      const { error } = await supabase.storage.from(this.bucketName).upload(path, fileBuffer, {
        contentType: 'application/pdf',
        cacheControl: '3600',
        upsert: false,
      });

      if (error) throw error;

      const {
        data: { publicUrl },
      } = supabase.storage.from(this.bucketName).getPublicUrl(path);

      return { url: publicUrl, path };
    } catch (error) {
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
    metadata?: Record<string, unknown>
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
        indexed_at: null,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async getDocument(documentId: string): Promise<Document | null> {
    const { data, error } = await supabase.from('documents').select().eq('id', documentId).single();

    if (error) return null;
    return data;
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

  async getSearchResultsCache(queryHash: string): Promise<unknown | null> {
    const { data, error } = await supabase
      .from('search_results_cache')
      .select()
      .eq('query_hash', queryHash)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (error || !data) return null;
    return data.results;
  }

  async setSearchResultsCache(queryText: string, results: unknown): Promise<void> {
    const queryHash = crypto.createHash('md5').update(queryText).digest('hex');

    await supabase.from('search_results_cache').upsert({
      query_hash: queryHash,
      query_text: queryText,
      results,
      expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // 1 hour
    });
  }
}
