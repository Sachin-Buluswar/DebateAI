import OpenAI from 'openai';
import { wikiSearchConfig } from './wikiSearch.config';
import { Annotation } from 'openai/resources/beta/threads/messages';
import { DocumentStorageService } from '@/backend/services/documentStorageService';

// Enhanced search result with PDF links
export interface EnhancedSearchResult {
  content: string;
  source?: string;
  score?: number;
  pdfUrl?: string;
  pageNumber?: number;
  documentId?: string;
  chunkId?: string;
}

// Simple exponential backoff helper (max 3 attempts)
const withRetry = async <T>(fn: () => Promise<T>, label: string, maxAttempts = 3): Promise<T> => {
  let attempt = 0;
  let delay = 500; // start at 0.5s
  while (true) {
    try {
      return await fn();
    } catch (err) {
      attempt += 1;
      if (attempt >= maxAttempts) {
        console.error(`[enhancedSearchVectorStore] ${label} failed after ${attempt} attempts.`);
        throw err;
      }
      console.warn(`[enhancedSearchVectorStore] ${label} failed (attempt ${attempt}). Retrying in ${delay}ms ...`, err);
      await new Promise((r) => setTimeout(r, delay));
      delay *= 2; // exponential backoff
    }
  }
};

/**
 * Enhanced search that includes PDF links and page numbers
 */
export const enhancedSearchVectorStore = async (
  openai: OpenAI,
  vectorStoreId: string,
  query: string,
  maxResults: number = 5
): Promise<EnhancedSearchResult[]> => {
  console.log(`[enhancedSearchVectorStore] Querying vector store ${vectorStoreId} with: "${query}" (top_k=${maxResults})`);

  const documentStorage = new DocumentStorageService();

  try {
    const tempAssistant = await withRetry(
      () => openai.beta.assistants.create({
        name: wikiSearchConfig.assistantName,
        instructions: wikiSearchConfig.assistantInstructions,
        model: 'gpt-4o',
        tools: [{ type: 'file_search' }],
        tool_resources: {
          file_search: {
            vector_store_ids: [vectorStoreId],
          },
        },
      }),
      'assistant creation'
    );

    const thread = await withRetry(
      () => openai.beta.threads.create(),
      'thread creation'
    );

    await withRetry(
      () => openai.beta.threads.messages.create(thread.id, {
        role: 'user',
        content: query,
      }),
      'message creation'
    );

    let run = await withRetry(
      () => openai.beta.threads.runs.create(thread.id, { assistant_id: tempAssistant.id }),
      'run creation'
    );

    // Poll until finished
    while (['queued', 'in_progress', 'requires_action'].includes(run.status)) {
      if (run.status === 'requires_action' && run.required_action?.type === 'submit_tool_outputs') {
        run = await withRetry(
          async () => {
            const response = await fetch(`https://api.openai.com/v1/threads/${thread.id}/runs/${run.id}/submit_tool_outputs`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
                'Content-Type': 'application/json',
                'OpenAI-Beta': 'assistants=v2'
              },
              body: JSON.stringify({ tool_outputs: [] })
            });
            return await response.json();
          },
          'submit tool outputs'
        );
      } else {
        await new Promise((r) => setTimeout(r, 1000));
        run = await withRetry(
          () => openai.beta.threads.runs.retrieve(run.id, { thread_id: thread.id }),
          'run retrieve'
        );
      }
    }

    if (run.status !== 'completed') {
      throw new Error(`Run ended with status: ${run.status}`);
    }

    // Get messages
    const messages = await withRetry(
      () => openai.beta.threads.messages.list(thread.id, { order: 'desc' }),
      'messages list'
    );

    const assistantMessage = messages.data.find((msg) => msg.role === 'assistant');
    if (!assistantMessage) {
      throw new Error('No assistant response found');
    }

    // Process results with enhanced metadata
    const aggregated: EnhancedSearchResult[] = [];
    
    for (const content of assistantMessage.content) {
      if (content.type === 'text' && content.text?.value) {
        const parts = content.text.value.split('【').filter(p => p);
        
        for (const part of parts) {
          const closingIndex = part.indexOf('】');
          const textVal = closingIndex > -1 ? part.substring(closingIndex + 1).trim() : part.trim();
          if (!textVal) continue;

          let result: EnhancedSearchResult = { content: textVal };

          // Extract file citation if available
          if (content.text.annotations?.length) {
            const citation = content.text.annotations.find((a: Annotation) => 
              (a as { type: string }).type === 'file_citation'
            );
            
            if (citation) {
              const openaiFileId = ((citation as { file_citation: { file_id: string } }).file_citation?.file_id);
              result.source = openaiFileId;

              // Look up chunk metadata in our database
              try {
                const chunk = await documentStorage.getChunkByOpenAIFileId(openaiFileId);
                
                if (chunk) {
                  const document = await documentStorage.getDocument(chunk.document_id);
                  
                  if (document) {
                    result.pdfUrl = document.file_url;
                    result.pageNumber = chunk.page_number;
                    result.documentId = document.id;
                    result.chunkId = chunk.id;
                    result.source = document.file_name;
                  }
                }
              } catch (error) {
                console.warn(`[enhancedSearchVectorStore] Could not retrieve metadata for file ${openaiFileId}:`, error);
              }
            }
          }

          // Add score based on position
          result.score = Math.max(0.1, 1.0 - (aggregated.length * 0.1));
          aggregated.push(result);
        }
      }
    }

    const limited = aggregated.slice(0, maxResults);
    console.log(`[enhancedSearchVectorStore] Enhanced search produced ${limited.length} results.`);

    // Cleanup temp resources
    await openai.beta.threads.delete(thread.id).catch(() => {});
    await openai.beta.assistants.delete(tempAssistant.id).catch(() => {});

    return limited;
    
  } catch (assistErr) {
    console.error('[enhancedSearchVectorStore] Enhanced search failed:', assistErr);
    
    // Fallback to error results
    const fallbackResults: EnhancedSearchResult[] = [
      {
        content: `Search temporarily unavailable for "${query}". The system is experiencing technical difficulties with the vector store. Please try again later or contact support if the issue persists.`,
        source: 'system-error',
        score: 0.0
      }
    ];
    
    return fallbackResults;
  }
};