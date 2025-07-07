import OpenAI from 'openai';
import { SearchResult } from './retrievalService'; // Import the SearchResult type

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
  openai: OpenAI,
  model: string,
  query: string,
  contextChunks: SearchResult[]
): Promise<GeneratedAnswer> => {
  console.log(`Generating answer for query: "${query}" using ${contextChunks.length} context chunks.`);

  if (contextChunks.length === 0) {
    console.log('No context provided, returning generic response.');
    // Handle cases with no retrieved context - maybe a specific message or attempt generation without context?
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

  console.log("System Prompt:", systemPrompt);
  console.log("User Prompt Snippet:", userPrompt.substring(0, 500) + "..."); // Log snippet for brevity

  try {
    // --- Call OpenAI Chat Completion API --- 
    const completion = await openai.chat.completions.create({
      model: model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.2, // Lower temperature for more factual, less creative answers
      max_tokens: 500, // Adjust as needed
    });

    const generatedAnswer = completion.choices[0]?.message?.content?.trim() || 'No answer generated.';
    console.log("Generated Answer:", generatedAnswer);

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
    console.error('Error generating answer from context:', error);
    throw new Error('Failed to generate answer using OpenAI API.');
  }
}; 