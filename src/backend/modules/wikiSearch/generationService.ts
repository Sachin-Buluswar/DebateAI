import OpenAI from 'openai';
import { openAIService } from '@/backend/services/openaiService';
import { SearchResult } from './retrievalService'; // Import the SearchResult type
import { aiLogger as logger } from '@/lib/monitoring/logger';

// Define the structure for the generated response
export interface GeneratedAnswer {
  answer: string;
  sources: Pick<SearchResult, 'source'>[]; // List sources used for the answer
}

/**
 * Generates a comprehensive answer using retrieved context and the original query.
 *
 * @param openai Initialized OpenAI client instance.
 * @param model The language model to use for generation (e.g., "gpt-4o").
 * @param query The original user query.
 * @param contextChunks An array of relevant SearchResult chunks retrieved from the vector store.
 * @returns A promise that resolves to a GeneratedAnswer object.
 */
export const generateAnswerFromContext = async (
  openai: OpenAI | null,
  model: string,
  query: string,
  contextChunks: SearchResult[]
): Promise<GeneratedAnswer> => {
  logger.info('Generating answer from context', {
    query,
    contextChunks: contextChunks.length,
    model
  });

  if (contextChunks.length === 0) {
    logger.warn('No context chunks provided for generation');
    return {
      answer: "I couldn't find specific information in the provided documents to answer that query.",
      sources: [],
    };
  }

  // --- Construct the Prompt --- 
  // Combine the retrieved chunks into a single context string.
  const contextString = contextChunks
    .map((chunk, index) => `Context Chunk [${index + 1}] (Source: ${chunk.source || 'Unknown'}):\n${chunk.content}`)
    .join('\n\n---\n\n');

  // Define the system message and user message for the chat completion
  const systemPrompt = `You are a helpful assistant. Answer the user's query based *only* on the provided context chunks. 
Do not use any prior knowledge. 
If the context does not contain the answer, state that you cannot answer from the provided documents. 
Cite the sources used in your answer using the format [Source: filename.txt].`;
  
  const userPrompt = `Context Chunks:
---
${contextString}
---

Query: ${query}

Answer:`;

  logger.debug('Generation prompts prepared', {
    queryLength: query.length,
    contextLength: contextString.length
  });

  try {
    // Use centralized service if openai client not provided
    const fallbackAnswer = "I'm unable to generate a comprehensive answer at the moment. Based on the available context, please refer to the source documents for more information.";
    
    let generatedAnswer: string;
    
    if (openai) {
      // Use provided OpenAI client (for backward compatibility)
      const completion = await openai.chat.completions.create({
        model: model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.2,
        max_tokens: 500,
      });
      generatedAnswer = completion.choices[0]?.message?.content?.trim() || fallbackAnswer;
    } else {
      // Use centralized service with error recovery
      const completion = await openAIService.createChatCompletion({
        model: model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.2,
        max_tokens: 500,
      }, {
        fallbackResponse: fallbackAnswer,
        validateResponse: (response) => response.length > 10
      });
      generatedAnswer = completion.choices[0]?.message?.content?.trim() || fallbackAnswer;
    }
    
    logger.info('Answer generated successfully', {
      answerLength: generatedAnswer.length,
      model
    });

    // --- Extract Used Sources (Simple approach: check which sources were mentioned) ---
    // This is a basic way to identify sources. More robust methods could involve analyzing citations.
    const uniqueSources = [...new Set(contextChunks.map(chunk => chunk.source).filter(Boolean))];
    const mentionedSources = uniqueSources.filter(source => 
        source && generatedAnswer.toLowerCase().includes(source.toLowerCase())
    );

    // If no sources explicitly mentioned, include all that were provided as context
    const sourcesToCite = mentionedSources.length > 0 
        ? mentionedSources 
        : uniqueSources;

    return {
      answer: generatedAnswer,
      sources: sourcesToCite.map(source => ({ source })),
    };

  } catch (error) {
    logger.error('Failed to generate answer from context', {
      error,
      query,
      contextChunks: contextChunks.length
    });
    
    // Return a fallback response instead of throwing
    return {
      answer: "I encountered an error while generating an answer. Please try again or refer to the source documents directly.",
      sources: contextChunks.map(chunk => ({ source: chunk.source })).filter(s => s.source),
    };
  }
}; 