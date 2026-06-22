import { OpenAI } from 'openai';
import { supabaseAdmin as supabase } from '@/server/lib/supabaseAdmin';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

interface ChunkData {
  content: string;
  sectionTitle?: string;
  chunkIndex: number;
}

export class EnhancedIndexingService {
  private chunkSize = 3200; // characters (~800 tokens)
  private chunkOverlap = 800; // characters (~200 tokens)

  async indexDocument(documentId: string, text: string, fileName: string): Promise<void> {
    const chunks = this.chunkText(text, fileName);

    if (chunks.length === 0) return;

    // Generate embeddings in batches of 50
    const embeddings = await this.generateEmbeddings(chunks.map((c) => c.content));

    // Insert chunks with embeddings in batches of 100
    const batchSize = 100;
    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);
      const batchEmbeddings = embeddings.slice(i, i + batchSize);

      const rows = batch.map((chunk, j) => ({
        document_id: documentId,
        chunk_index: chunk.chunkIndex,
        content: chunk.content,
        section_title: chunk.sectionTitle,
        embedding: JSON.stringify(batchEmbeddings[j]),
        metadata: {},
      }));

      const { error } = await supabase.from('document_chunks').insert(rows);

      if (error) throw new Error(`Failed to insert chunks: ${error.message}`);
    }

    // Mark document as indexed
    await supabase
      .from('documents')
      .update({ indexed_at: new Date().toISOString() })
      .eq('id', documentId);
  }

  private chunkText(text: string, fileName: string): ChunkData[] {
    const chunks: ChunkData[] = [];
    const lines = text.split('\n');
    let currentSection: string | undefined;
    let currentText = '';
    let chunkIndex = 0;

    for (const line of lines) {
      const trimmed = line.trim();

      // Detect section headers (uppercase lines, numbered headings)
      if (
        trimmed.length > 0 &&
        trimmed.length < 120 &&
        (trimmed === trimmed.toUpperCase() || /^\d+[.)]\s/.test(trimmed))
      ) {
        currentSection = trimmed;
      }

      currentText += line + '\n';

      // Check if we've exceeded chunk size
      if (currentText.length >= this.chunkSize) {
        const breakPoint = this.findBreakPoint(currentText, this.chunkSize);
        const chunkContent = currentText.slice(0, breakPoint).trim();

        if (chunkContent.length > 50) {
          const prefix = `[Source: ${fileName}${currentSection ? `, Section: ${currentSection}` : ''}]`;
          chunks.push({
            content: `${prefix}\n\n${chunkContent}`,
            sectionTitle: currentSection,
            chunkIndex: chunkIndex++,
          });
        }

        // Keep overlap
        currentText = currentText.slice(Math.max(0, breakPoint - this.chunkOverlap));
      }
    }

    // Last chunk
    if (currentText.trim().length > 50) {
      const prefix = `[Source: ${fileName}${currentSection ? `, Section: ${currentSection}` : ''}]`;
      chunks.push({
        content: `${prefix}\n\n${currentText.trim()}`,
        sectionTitle: currentSection,
        chunkIndex: chunkIndex,
      });
    }

    return chunks;
  }

  private findBreakPoint(text: string, target: number): number {
    const rangeStart = Math.max(0, target - 500);
    const rangeEnd = Math.min(text.length, target + 200);
    const searchRange = text.slice(rangeStart, rangeEnd);

    // Try sentence boundary first
    const sentenceEnd = searchRange.lastIndexOf('. ');
    if (sentenceEnd !== -1) return rangeStart + sentenceEnd + 2;

    // Try newline
    const newline = searchRange.lastIndexOf('\n');
    if (newline !== -1) return rangeStart + newline + 1;

    return target;
  }

  private async generateEmbeddings(texts: string[]): Promise<number[][]> {
    const allEmbeddings: number[][] = [];
    const batchSize = 50;

    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);

      const response = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: batch,
      });

      for (const item of response.data) {
        allEmbeddings.push(item.embedding);
      }
    }

    return allEmbeddings;
  }
}
