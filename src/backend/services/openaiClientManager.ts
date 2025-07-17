import { OpenAI } from 'openai';
import { env } from '@/shared/env';
import { globalErrorRecovery } from '@/lib/errorRecovery';
import { aiLogger as logger } from '@/lib/monitoring/logger';
import { openaiPerformance } from '@/lib/monitoring/performance';

/**
 * Centralized OpenAI Client Manager
 * 
 * This singleton manager provides:
 * - Connection pooling (single client instance)
 * - Built-in error recovery with exponential backoff
 * - Circuit breaker protection
 * - Performance monitoring
 * - Automatic retry logic
 */
class OpenAIClientManager {
  private static instance: OpenAIClientManager;
  private client: OpenAI | null = null;
  private initializationPromise: Promise<OpenAI> | null = null;

  private constructor() {}

  static getInstance(): OpenAIClientManager {
    if (!OpenAIClientManager.instance) {
      OpenAIClientManager.instance = new OpenAIClientManager();
    }
    return OpenAIClientManager.instance;
  }

  /**
   * Get the OpenAI client instance with lazy initialization
   */
  async getClient(): Promise<OpenAI> {
    // If already initialized, return the client
    if (this.client) {
      return this.client;
    }

    // If initialization is in progress, wait for it
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    // Start initialization
    this.initializationPromise = this.initializeClient();
    
    try {
      this.client = await this.initializationPromise;
      return this.client;
    } finally {
      this.initializationPromise = null;
    }
  }

  /**
   * Initialize the OpenAI client with proper configuration
   */
  private async initializeClient(): Promise<OpenAI> {
    try {
      if (!env.OPENAI_API_KEY) {
        throw new Error('OpenAI API key is not configured');
      }

      const client = new OpenAI({
        apiKey: env.OPENAI_API_KEY,
        maxRetries: 0, // We handle retries ourselves for better control
        timeout: 30000, // 30 second timeout
      });

      logger.info('OpenAI client initialized successfully');
      return client;
    } catch (error) {
      logger.error('Failed to initialize OpenAI client', error);
      throw error;
    }
  }

  /**
   * Execute a chat completion with built-in error recovery
   */
  async createChatCompletion(
    params: OpenAI.ChatCompletionCreateParams,
    options?: {
      fallbackResponse?: string;
      shouldRetry?: (error: any) => boolean;
      maxRetries?: number;
    }
  ): Promise<OpenAI.ChatCompletion> {
    const client = await this.getClient();
    
    return globalErrorRecovery.executeWithRecovery(
      async () => {
        // Use trackAPICall to automatically handle timing and logging
        return await openaiPerformance.trackAPICall(
          'chat.completions',
          async () => await client.chat.completions.create(params),
          {
            model: params.model,
            messages: params.messages.length,
            maxTokens: params.max_tokens
          }
        );
      },
      {
        operation: 'openai-chat-completion',
        retryOptions: {
          maxRetries: options?.maxRetries ?? 3,
          shouldRetry: options?.shouldRetry ?? ((error) => {
            // Retry on rate limits, timeouts, and server errors
            if (error?.status >= 500) return true;
            if (error?.status === 429) return true;
            if (error?.code === 'ETIMEDOUT') return true;
            if (error?.code === 'ECONNRESET') return true;
            return false;
          }),
        },
        circuitBreakerOptions: {
          operation: 'openai-api',
          threshold: 5, // Open circuit after 5 failures
          timeout: 60000, // Try again after 1 minute
        },
        fallbackOptions: options?.fallbackResponse ? {
          fallback: async () => ({
            id: 'fallback',
            object: 'chat.completion' as const,
            created: Date.now(),
            model: params.model,
            choices: [{
              index: 0,
              message: {
                role: 'assistant' as const,
                content: options.fallbackResponse,
              },
              finish_reason: 'stop' as const,
            }],
            usage: {
              prompt_tokens: 0,
              completion_tokens: 0,
              total_tokens: 0,
            },
          }),
        } : undefined,
      }
    );
  }

  /**
   * Execute a transcription with built-in error recovery
   */
  async createTranscription(
    params: OpenAI.Audio.TranscriptionCreateParams,
    options?: {
      fallbackResponse?: any;
      shouldRetry?: (error: any) => boolean;
      maxRetries?: number;
    }
  ): Promise<OpenAI.Audio.Transcription> {
    const client = await this.getClient();
    
    return globalErrorRecovery.executeWithRecovery(
      async () => {
        // Use trackAPICall to automatically handle timing and logging
        return await openaiPerformance.trackAPICall(
          'audio.transcriptions',
          async () => await client.audio.transcriptions.create(params),
          {
            model: params.model,
            responseFormat: params.response_format
          }
        );
      },
      {
        operation: 'openai-transcription',
        retryOptions: {
          maxRetries: options?.maxRetries ?? 3,
          shouldRetry: options?.shouldRetry ?? ((error) => {
            // Same retry logic as chat completions
            if (error?.status >= 500) return true;
            if (error?.status === 429) return true;
            if (error?.code === 'ETIMEDOUT') return true;
            if (error?.code === 'ECONNRESET') return true;
            return false;
          }),
        },
        circuitBreakerOptions: {
          operation: 'openai-whisper',
          threshold: 3, // Lower threshold for Whisper
          timeout: 30000, // 30 seconds
        },
        fallbackOptions: options?.fallbackResponse ? {
          fallback: async () => options.fallbackResponse,
        } : undefined,
      }
    );
  }

  /**
   * Get the raw client for operations not yet wrapped
   * Use sparingly - prefer wrapped methods for error recovery
   */
  async getRawClient(): Promise<OpenAI> {
    return this.getClient();
  }

  /**
   * Reset the client (useful for testing or error recovery)
   */
  reset(): void {
    this.client = null;
    this.initializationPromise = null;
    logger.info('OpenAI client reset');
  }

  /**
   * Health check for the OpenAI client
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'unhealthy';
    latency?: number;
    error?: string;
  }> {
    const startTime = Date.now();
    
    try {
      const client = await this.getClient();
      
      // Simple completion to test connectivity
      await client.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: 'test' }],
        max_tokens: 1,
      });
      
      return {
        status: 'healthy',
        latency: Date.now() - startTime,
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
        latency: Date.now() - startTime,
      };
    }
  }
}

// Export singleton instance
export const openAIManager = OpenAIClientManager.getInstance();

// Export convenience functions for common operations
export const createChatCompletion = openAIManager.createChatCompletion.bind(openAIManager);
export const createTranscription = openAIManager.createTranscription.bind(openAIManager);
export const getOpenAIClient = openAIManager.getRawClient.bind(openAIManager);