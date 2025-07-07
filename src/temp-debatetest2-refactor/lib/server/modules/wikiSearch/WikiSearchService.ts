import OpenAI from 'openai';
import { env } from '@/shared/env';

interface SearchResult {
  title: string;
  excerpt: string;
  relevanceScore: number;
  source: string;
  metadata?: Record<string, unknown>;
}

interface WikiDocument {
  id: string;
  title: string;
  content: string;
  embedding: number[];
  metadata: {
    url: string;
    lastUpdated: string;
    section?: string;
    wordCount: number;
  };
}

/**
 * WikiSearchService provides RAG-based evidence gathering using OpenAI Vector Storage
 * for finding relevant information to support debate arguments
 */
export class WikiSearchService {
  private openai: OpenAI;
  private vectorStoreId: string;
  
  constructor(vectorStoreId?: string) {
    this.openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });
    // Use provided vector store ID or default debate knowledge base
    this.vectorStoreId = vectorStoreId || env.OPENAI_VECTOR_STORE_ID || '';
  }

  /**
   * Search for evidence and supporting information for a debate topic
   */
  async searchEvidence(
    query: string, 
    debateTopic: string,
    perspective: 'PRO' | 'CON' | 'NEUTRAL' = 'NEUTRAL',
    maxResults: number = 5
  ): Promise<SearchResult[]> {
    try {
      // Enhance query with debate context
      const enhancedQuery = this.enhanceQueryForDebate(query, debateTopic, perspective);
      
      // Create query embedding
      const embedding = await this.createEmbedding(enhancedQuery);
      
      // Search vector store
      const searchResults = await this.searchVectorStore(embedding, maxResults * 2);
      
      // Rank and filter results based on relevance to the debate
      const rankedResults = await this.rankResultsForDebate(
        searchResults, 
        query, 
        debateTopic, 
        perspective
      );
      
      return rankedResults.slice(0, maxResults);
    } catch (error) {
      console.error('Error searching evidence:', error);
      return [];
    }
  }

  /**
   * Get contextual information about a specific topic
   */
  async getTopicContext(topic: string): Promise<SearchResult[]> {
    try {
      const contextQuery = `comprehensive overview of ${topic} including background, key facts, statistics, and different perspectives`;
      return await this.searchEvidence(contextQuery, topic, 'NEUTRAL', 3);
    } catch (error) {
      console.error('Error getting topic context:', error);
      return [];
    }
  }

  /**
   * Find counter-arguments for a given position
   */
  async findCounterArguments(
    argument: string, 
    debateTopic: string,
    currentPerspective: 'PRO' | 'CON'
  ): Promise<SearchResult[]> {
    const opposingPerspective = currentPerspective === 'PRO' ? 'CON' : 'PRO';
    const counterQuery = `criticisms arguments against ${argument} opposing viewpoint ${debateTopic}`;
    
    return await this.searchEvidence(counterQuery, debateTopic, opposingPerspective, 3);
  }

  /**
   * Find supporting evidence for a claim
   */
  async findSupportingEvidence(
    claim: string,
    debateTopic: string,
    perspective: 'PRO' | 'CON'
  ): Promise<SearchResult[]> {
    const evidenceQuery = `evidence data statistics research supporting ${claim} ${debateTopic}`;
    
    return await this.searchEvidence(evidenceQuery, debateTopic, perspective, 4);
  }

  /**
   * Get expert opinions and authoritative sources
   */
  async getExpertOpinions(
    topic: string,
    perspective: 'PRO' | 'CON' | 'NEUTRAL' = 'NEUTRAL'
  ): Promise<SearchResult[]> {
    const expertQuery = `expert opinion academic research authoritative source ${topic}`;
    
    return await this.searchEvidence(expertQuery, topic, perspective, 3);
  }

  /**
   * Add new documents to the vector store (placeholder for future implementation)
   */
  async addDocument(document: WikiDocument): Promise<void> {
    console.log(`Document ${document.title} would be added to vector store (feature coming soon)`);
    // TODO: Implement when OpenAI vector stores are stable
  }

  /**
   * Enhance search query with debate-specific context
   */
  private enhanceQueryForDebate(
    query: string, 
    debateTopic: string, 
    perspective: 'PRO' | 'CON' | 'NEUTRAL'
  ): string {
    let enhancement = `${query} related to ${debateTopic}`;
    
    if (perspective === 'PRO') {
      enhancement += ' benefits advantages positive aspects supporting arguments';
    } else if (perspective === 'CON') {
      enhancement += ' drawbacks disadvantages negative aspects opposing arguments';
    }
    
    return enhancement;
  }

  /**
   * Create embedding for text using OpenAI
   */
  private async createEmbedding(text: string): Promise<number[]> {
    const response = await this.openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: text,
    });
    
    return response.data[0].embedding;
  }

  /**
   * Search vector store with embedding
   */
  private async searchVectorStore(embedding: number[], limit: number): Promise<Record<string, unknown>[]> {
    // Note: This is a placeholder implementation
    // In a real implementation, you would use OpenAI's vector store search
    // or implement your own similarity search
    
    try {
      // For now, we'll use a simple text search as fallback
      return await this.fallbackTextSearch(embedding, limit);
    } catch (error) {
      console.error('Vector store search failed:', error);
      return [];
    }
  }

  /**
   * Rank search results based on relevance to debate context
   */
  private async rankResultsForDebate(
    results: Record<string, unknown>[],
    originalQuery: string,
    debateTopic: string,
    perspective: 'PRO' | 'CON' | 'NEUTRAL'
  ): Promise<SearchResult[]> {
    if (results.length === 0) return [];

    try {
      // Use OpenAI to rank results based on debate relevance
      const rankingPrompt = `
        Rank the following search results by relevance to a debate on "${debateTopic}" 
        from a ${perspective} perspective for the query: "${originalQuery}"
        
        Consider:
        1. Factual accuracy and credibility
        2. Relevance to the specific debate topic
        3. Usefulness for ${perspective === 'NEUTRAL' ? 'either side' : perspective + ' arguments'}
        4. Quality and recency of information
        
        Results: ${JSON.stringify(results.slice(0, 10))}
        
        Return a JSON array of results with relevanceScore (0-1) and explanation.
      `;

      const rankingResponse = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: rankingPrompt }],
        temperature: 0.3,
        max_tokens: 1000
      });

      const rankedData = JSON.parse(rankingResponse.choices[0]?.message?.content || '[]');
      
      return rankedData.map((item: Record<string, unknown>) => ({
        title: item.title as string || 'Unknown Source',
        excerpt: (item.excerpt || (item.content as string)?.substring(0, 200) + '...') as string,
        relevanceScore: item.relevanceScore as number || 0.5,
        source: (item.source || item.url) as string || 'Unknown',
        metadata: item.metadata as Record<string, unknown> || {}
      }));
      
    } catch (error) {
      console.error('Error ranking results:', error);
      // Return unranked results as fallback
      return results.map(result => ({
        title: result.title as string || 'Source',
        excerpt: (result.content as string)?.substring(0, 200) + '...' || '',
        relevanceScore: 0.5,
        source: result.url as string || 'Unknown',
        metadata: result.metadata as Record<string, unknown> || {}
      }));
    }
  }

  /**
   * Fallback text search when vector search is unavailable
   */
  private async fallbackTextSearch(embedding: number[], limit: number): Promise<Record<string, unknown>[]> {
    // This is a simplified fallback - in production you would have
    // a pre-indexed knowledge base or external API integration
    
    const mockResults = [
      {
        title: "Sample Research Article",
        content: "This is a placeholder for actual search results from your knowledge base.",
        url: "https://example.com/research",
        metadata: { 
          type: "academic",
          date: new Date().toISOString(),
          credibility: "high"
        }
      }
    ];
    
    return mockResults.slice(0, limit);
  }

  /**
   * Upload document content as a file for vector store
   */
  private async uploadFile(document: WikiDocument): Promise<string> {
    const fileContent = `Title: ${document.title}\n\nContent: ${document.content}`;
    
    const file = await this.openai.files.create({
      file: new File([fileContent], `${document.id}.txt`, { type: 'text/plain' }),
      purpose: 'assistants'
    });
    
    return file.id;
  }

  /**
   * Initialize vector store if it doesn't exist (placeholder for future implementation)
   */
  async initializeVectorStore(name: string = 'DebateAI Knowledge Base'): Promise<string> {
    console.log(`Vector store ${name} initialization coming soon`);
    // TODO: Implement when OpenAI vector stores are stable
    return 'placeholder-vector-store-id';
  }
} 