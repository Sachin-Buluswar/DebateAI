// Define the expected structure for search results
export interface SearchResult {
  content: string;
  source?: string; // e.g., original filename chunk came from
  score?: number; // Relevance score, if provided by API
}
