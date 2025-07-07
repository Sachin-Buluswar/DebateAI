/**
 * Configuration for the Wiki Search (Vector Store) module.
 * This file centralizes key parameters for document processing and indexing,
 * allowing for easy tuning and experimentation.
 */

export const wikiSearchConfig = {
  /**
   * The target size for each text chunk, in characters.
   * Default: 1000
   */
  chunkSize: 1000,

  /**
   * The number of characters to overlap between consecutive chunks.
   * This helps maintain context across chunk boundaries.
   * Default: 100
   */
  chunkOverlap: 100,

  /**
   * The model used for generating embeddings. This is not currently used
   * as the `file_search` tool handles embeddings implicitly, but it's
   * here for future-proofing if we switch to manual embedding.
   * Default: 'text-embedding-ada-002'
   */
  embeddingModel: 'text-embedding-ada-002',

  /**
   * Instructions for the temporary assistant used in the fallback search mechanism.
   */
  assistantInstructions: 'You are an assistant designed solely to search the attached vector store using the file_search tool based on user queries. Answer ONLY with relevant passages from the vector store that best address the user query.',

  /**
   * The name for the temporary search assistant.
   */
  assistantName: 'Wiki Search Assistant (Temporary)',
}; 