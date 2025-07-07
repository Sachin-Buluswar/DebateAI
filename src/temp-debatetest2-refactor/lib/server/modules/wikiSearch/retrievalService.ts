import OpenAI from 'openai';
import { wikiSearchConfig } from './wikiSearch.config';
import { Annotation } from 'openai/resources/beta/threads/messages';

// Define the expected structure for search results
export interface SearchResult {
  content: string;
  source?: string; // e.g., original filename chunk came from
  score?: number;  // Relevance score, if provided by API
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
        console.error(`[searchVectorStore] ${label} failed after ${attempt} attempts.`);
        throw err;
      }
      console.warn(`[searchVectorStore] ${label} failed (attempt ${attempt}). Retrying in ${delay}ms ...`, err);
      await new Promise((r) => setTimeout(r, delay));
      delay *= 2; // exponential backoff
    }
  }
};

/**
 * Queries the specified OpenAI Vector Store for relevant documents.
 *
 * This function uses a temporary assistant and thread to leverage the
 * vector store's file search capabilities.
 *
 * @param openai Initialized OpenAI client instance.
 * @param vectorStoreId The ID of the OpenAI Vector Store to query.
 * @param query The user's search query.
 * @param maxResults Optional limit for the number of results.
 * @returns A promise that resolves to an array of SearchResult objects.
 */
export const searchVectorStore = async (
  openai: OpenAI,
  vectorStoreId: string,
  query: string,
  maxResults: number = 5 // Default top_k
): Promise<SearchResult[]> => {
  console.log(`[searchVectorStore] Querying vector store ${vectorStoreId} with: "${query}" (top_k=${maxResults})`);

  // -------- Primary: Assistant + file_search tool (production implementation) --------
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
    ) as any;

    // Poll until finished
    while (['queued', 'in_progress', 'requires_action'].includes(run.status)) {
      if (run.status === 'requires_action' && run.required_action?.type === 'submit_tool_outputs') {
        // No additional tool outputs needed for file_search – submit empty list
        run = await withRetry(
          () => (openai.beta.threads.runs as any).submitToolOutputs(thread.id, run.id, { tool_outputs: [] }),
          'submit tool outputs'
        ) as any;
      } else {
        await new Promise((r) => setTimeout(r, 1000));
        run = await withRetry(
          () => (openai.beta.threads.runs as any).retrieve(thread.id, run.id),
          'retrieve run status'
        ) as any;
      }
    }

    if (run.status !== 'completed') {
      throw new Error(`Assistant run ended with status ${run.status}`);
    }

    const messages = await openai.beta.threads.messages.list(thread.id, { order: 'asc' });

    const aggregated: SearchResult[] = [];
    for (const msg of messages.data) {
      if (msg.role !== 'assistant') continue;
      for (const part of msg.content) {
        if (part.type !== 'text') continue;
        const textVal = part.text.value;
        if (!textVal.trim()) continue;

        // Extract annotations for citations if any
        let source: string | undefined;
        if (part.text.annotations?.length) {
          const citation = part.text.annotations.find((a: Annotation) => (a as { type: string }).type === 'file_citation');
          if (citation) {
            source = ((citation as { file_citation: { file_id: string } }).file_citation?.file_id);
          }
        }
        aggregated.push({ content: textVal, source });
      }
    }

    const limited = aggregated.slice(0, maxResults);
    console.log(`[searchVectorStore] Assistant search produced ${limited.length} results.`);

    // Cleanup temp resources
    await openai.beta.threads.delete(thread.id).catch(() => {});
    await openai.beta.assistants.delete(tempAssistant.id).catch(() => {});

    return limited;
    
  } catch (assistErr) {
    console.error('[searchVectorStore] Assistant-based search failed:', assistErr);
    
    // -------- Fallback: Return informative error results --------
    console.log('[searchVectorStore] Falling back to error results');
    const fallbackResults: SearchResult[] = [
      {
        content: `Search temporarily unavailable for "${query}". The system is experiencing technical difficulties with the vector store. Please try again later or contact support if the issue persists.`,
        source: 'system-error',
        score: 0.0
      }
    ];
    
    return fallbackResults;
  }
}; 