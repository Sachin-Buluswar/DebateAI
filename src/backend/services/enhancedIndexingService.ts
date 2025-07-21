import { OpenAI } from 'openai';
import { DocumentStorageService } from './documentStorageService';
import { DocumentChunk } from '@/types/documents';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as stream from 'stream';
import fetch from 'node-fetch';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

interface ChunkMetadata {
  pageNumber: number;
  pageStartChar: number;
  pageEndChar: number;
  docStartChar: number;
  docEndChar: number;
  sectionTitle?: string;
}

export class EnhancedIndexingService {
  private documentStorage: DocumentStorageService;
  private chunkSize = 800; // tokens
  private chunkOverlap = 200; // tokens
  private vectorStoreId: string;

  constructor() {
    this.documentStorage = new DocumentStorageService();
    this.vectorStoreId = process.env.OPENAI_VECTOR_STORE_ID!;
  }

  async indexPDFDocument(
    documentId: string,
    pdfUrl: string,
    fileName: string
  ): Promise<void> {
    try {
      console.log(`Starting enhanced indexing for ${fileName}`);
      
      // Download PDF
      const pdfBuffer = await this.downloadPDF(pdfUrl);
      
      // Dynamically import pdf-parse to avoid module-level execution
      const pdfParse = await import('pdf-parse').then(m => m.default || m);
      
      // Parse PDF with custom page renderer to extract page-by-page content
      const pages: Array<{ pageNumber: number; text: string }> = [];
      let totalPages = 0;
      
      const pdfData = await pdfParse(pdfBuffer, {
        pagerender: (pageData: any) => {
          return pageData.getTextContent()
            .then((textContent: any) => {
              let text = '';
              for (const item of textContent.items) {
                text += item.str + ' ';
              }
              return text;
            });
        },
        // renderTextLayer: false, // This option doesn't exist in pdf-parse
      });
      
      // Get total pages
      totalPages = pdfData.numpages;
      
      // Parse PDF again to extract page-by-page content
      for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
        const pagePdfData = await pdfParse(pdfBuffer, {
          max: pageNum,
          pagerender: (pageData: any) => {
            const currentPage = pageData.pageNumber || pageData.pageIndex + 1;
            if (currentPage === pageNum) {
              return pageData.getTextContent()
                .then((textContent: any) => {
                  let text = '';
                  for (const item of textContent.items) {
                    text += item.str + ' ';
                  }
                  pages.push({ pageNumber: pageNum, text: text.trim() });
                  return text;
                });
            }
            return '';
          },
        });
      }
      
      // Extract chunks with proper page metadata
      const chunks = await this.extractChunksWithPageMetadata(pages, fileName);
      
      // Upload chunks to OpenAI
      const openaiFileIds = await this.uploadChunksToOpenAI(chunks, documentId, fileName);
      
      // Store chunks in database with OpenAI file IDs
      const dbChunks: Omit<DocumentChunk, 'id' | 'created_at'>[] = chunks.map((chunk, index) => ({
        document_id: documentId,
        chunk_index: index,
        content: chunk.content,
        page_number: chunk.metadata.pageNumber,
        page_start_char: chunk.metadata.pageStartChar,
        page_end_char: chunk.metadata.pageEndChar,
        doc_start_char: chunk.metadata.docStartChar,
        doc_end_char: chunk.metadata.docEndChar,
        section_title: chunk.metadata.sectionTitle,
        openai_file_id: openaiFileIds[index],
        metadata: {},
      }));
      
      await this.documentStorage.createDocumentChunks(dbChunks);
      
      // Update document as indexed
      await this.documentStorage.updateDocumentIndexStatus(documentId);
      
      console.log(`Successfully indexed ${fileName} with ${chunks.length} chunks from ${totalPages} pages`);
      
    } catch (error) {
      console.error(`Error indexing document ${fileName}:`, error);
      throw error;
    }
  }

  private async downloadPDF(url: string): Promise<Buffer> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to download PDF: ${response.statusText}`);
    }
    return Buffer.from(await response.arrayBuffer());
  }

  private async extractChunksWithPageMetadata(
    pages: Array<{ pageNumber: number; text: string }>,
    fileName: string
  ): Promise<Array<{ content: string; metadata: ChunkMetadata }>> {
    const chunks: Array<{ content: string; metadata: ChunkMetadata }> = [];
    let docCharOffset = 0;
    let chunkIndex = 0;
    
    // Process each page
    for (const page of pages) {
      const pageText = page.text;
      const pageNumber = page.pageNumber;
      const pageStartChar = 0;
      
      // Skip empty pages
      if (!pageText.trim()) {
        continue;
      }
      
      // Extract sections from page
      const sections = this.extractSections(pageText);
      
      for (const section of sections) {
        const sectionChunks = await this.chunkText(
          section.content,
          this.chunkSize,
          this.chunkOverlap
        );
        
        let sectionCharOffset = 0;
        
        for (const chunkText of sectionChunks) {
          const chunkStartChar = section.content.indexOf(chunkText, sectionCharOffset);
          const chunkEndChar = chunkStartChar + chunkText.length;
          
          // Update section offset for next search
          sectionCharOffset = chunkStartChar + 1;
          
          chunks.push({
            content: this.formatChunkWithMetadata(
              chunkText,
              fileName,
              pageNumber,
              section.title
            ),
            metadata: {
              pageNumber: pageNumber,
              pageStartChar: chunkStartChar,
              pageEndChar: chunkEndChar,
              docStartChar: docCharOffset + chunkStartChar,
              docEndChar: docCharOffset + chunkEndChar,
              sectionTitle: section.title,
            },
          });
          
          chunkIndex++;
        }
      }
      
      docCharOffset += pageText.length;
    }
    
    return chunks;
  }

  private extractSections(pageText: string): Array<{ title?: string; content: string }> {
    // Simple section extraction based on common patterns
    const sections: Array<{ title?: string; content: string }> = [];
    
    // Look for headings (lines that are all caps or start with numbers)
    const lines = pageText.split('\n');
    let currentSection = { title: undefined as string | undefined, content: '' };
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      
      // Check if line is a heading
      if (
        trimmedLine.length > 0 &&
        (trimmedLine === trimmedLine.toUpperCase() || /^\d+\./.test(trimmedLine)) &&
        trimmedLine.length < 100
      ) {
        // Save previous section if it has content
        if (currentSection.content.trim()) {
          sections.push(currentSection);
        }
        
        // Start new section
        currentSection = { title: trimmedLine, content: '' };
      } else {
        currentSection.content += line + '\n';
      }
    }
    
    // Don't forget the last section
    if (currentSection.content.trim()) {
      sections.push(currentSection);
    }
    
    // If no sections found, treat whole page as one section
    if (sections.length === 0) {
      sections.push({ content: pageText });
    }
    
    return sections;
  }

  private async chunkText(
    text: string,
    maxChunkSize: number,
    overlap: number
  ): Promise<string[]> {
    // Estimate tokens (rough approximation: 1 token ≈ 4 characters)
    const approxCharsPerToken = 4;
    const maxChunkChars = maxChunkSize * approxCharsPerToken;
    const overlapChars = overlap * approxCharsPerToken;
    
    const chunks: string[] = [];
    let start = 0;
    
    while (start < text.length) {
      let end = Math.min(start + maxChunkChars, text.length);
      
      // Try to break at sentence boundary
      if (end < text.length) {
        const lastPeriod = text.lastIndexOf('.', end);
        const lastNewline = text.lastIndexOf('\n', end);
        const breakPoint = Math.max(lastPeriod, lastNewline);
        
        if (breakPoint > start + maxChunkChars / 2) {
          end = breakPoint + 1;
        }
      }
      
      chunks.push(text.slice(start, end).trim());
      
      // Move start position with overlap
      start = end - overlapChars;
      
      // Ensure we don't get stuck
      if (start >= text.length - 10) break;
    }
    
    return chunks.filter(chunk => chunk.length > 0);
  }

  private formatChunkWithMetadata(
    content: string,
    fileName: string,
    pageNumber: number,
    sectionTitle?: string
  ): string {
    let metadata = `[Source: ${fileName}, Page: ${pageNumber}`;
    if (sectionTitle) {
      metadata += `, Section: ${sectionTitle}`;
    }
    metadata += ']\n\n';
    
    return metadata + content;
  }

  private async uploadChunksToOpenAI(
    chunks: Array<{ content: string; metadata: ChunkMetadata }>,
    documentId: string,
    fileName: string
  ): Promise<string[]> {
    const fileIds: string[] = [];
    const batchSize = 10;
    
    // Process chunks in batches
    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);
      const batchPromises = batch.map(async (chunk, batchIndex) => {
        const chunkIndex = i + batchIndex;
        const chunkFileName = `${fileName}_chunk_${chunkIndex}_page_${chunk.metadata.pageNumber}.txt`;
        
        // Create a file-like object for OpenAI upload
        // OpenAI SDK accepts a stream with name property
        const buffer = Buffer.from(chunk.content, 'utf-8');
        const readableStream = new stream.Readable();
        readableStream.push(buffer);
        readableStream.push(null);
        
        // Add required properties for OpenAI SDK
        (readableStream as any).name = chunkFileName;
        (readableStream as any).size = buffer.length;
        
        // Upload to OpenAI
        const fileObject = await openai.files.create({
          file: readableStream as any,
          purpose: 'assistants',
        });
        
        return fileObject.id;
      });
      
      const batchFileIds = await Promise.all(batchPromises);
      fileIds.push(...batchFileIds);
    }
    
    // Add files to vector store
    await this.addFilesToVectorStore(fileIds);
    
    return fileIds;
  }

  private async addFilesToVectorStore(fileIds: string[]): Promise<void> {
    const batchSize = 100;
    
    for (let i = 0; i < fileIds.length; i += batchSize) {
      const batch = fileIds.slice(i, i + batchSize);
      
      const response = await fetch(
        `https://api.openai.com/v1/vector_stores/${this.vectorStoreId}/file_batches`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
            'Content-Type': 'application/json',
            'OpenAI-Beta': 'assistants=v2',
          },
          body: JSON.stringify({ file_ids: batch }),
        }
      );
      
      if (!response.ok) {
        throw new Error(`Failed to add files to vector store: ${response.statusText}`);
      }
      
      // Wait for batch to process
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  async reindexExistingDocuments(): Promise<void> {
    console.log('Starting reindexing of existing documents...');
    
    // Get all documents
    const documents = await this.documentStorage.searchDocuments('');
    
    for (const document of documents) {
      if (!document.indexed_at) {
        console.log(`Reindexing: ${document.file_name}`);
        try {
          await this.indexPDFDocument(document.id, document.file_url, document.file_name);
        } catch (error) {
          console.error(`Failed to reindex ${document.file_name}:`, error);
        }
      }
    }
    
    console.log('Reindexing complete');
  }
}