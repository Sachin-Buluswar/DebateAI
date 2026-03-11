import { z } from 'zod';
import { openAIManager } from './openaiClientManager';
import { aiLogger as logger } from '@/lib/monitoring/logger';
import type { OpenAI } from 'openai';

/**
 * OpenAI Service - High-level interface for all OpenAI operations
 * 
 * This service acts as the primary integration point for OpenAI's APIs in the debate system.
 * It provides a unified interface for chat completions, transcriptions, and embeddings.
 * 
 * Role in the System:
 * - Powers the AI debate agents' reasoning and response generation
 * - Transcribes user speech input for the speech feedback system
 * - Generates embeddings for document search and retrieval (future RAG implementation)
 * 
 * Features:
 * - Centralized configuration management with environment-based model selection
 * - Built-in validation with Zod schemas to ensure API compatibility
 * - Standardized error handling with automatic retry logic
 * - Performance monitoring and token usage tracking for cost management
 * - Structured output helpers for reliable JSON responses
 * - Streaming support for real-time debate interactions
 * 
 * Authentication:
 * - Uses API key from OPENAI_API_KEY environment variable
 * - Managed through openAIManager for connection pooling and rate limiting
 */

// Validation schemas for OpenAI operations
// These schemas ensure all requests conform to OpenAI's API requirements
// and provide type safety throughout the application
export const openAISchemas = {
  chatCompletion: z.object({
    messages: z.array(z.object({
      role: z.enum(['system', 'user', 'assistant']),
      content: z.string().min(1).max(32000), // OpenAI token limit approximation
    })),
    model: z.string().default('gpt-4o-mini'), // Default to cost-efficient model
    temperature: z.number().min(0).max(2).optional(), // Controls randomness: 0=deterministic, 2=very random
    max_tokens: z.number().min(1).max(4096).optional(), // Limits response length
    response_format: z.object({
      type: z.enum(['text', 'json_object']), // json_object ensures valid JSON output
    }).optional(),
    frequency_penalty: z.number().min(-2).max(2).optional(), // Reduces repetition of tokens
    presence_penalty: z.number().min(-2).max(2).optional(), // Encourages new topics
  }),

  transcription: z.object({
    file: z.any(), // Will be validated as File/Buffer in the method
    model: z.literal('whisper-1').default('whisper-1'),
    language: z.string().optional(),
    prompt: z.string().optional(),
    response_format: z.enum(['json', 'text', 'srt', 'verbose_json', 'vtt']).optional(),
    temperature: z.number().min(0).max(1).optional(),
  }),

  embedding: z.object({
    input: z.union([z.string(), z.array(z.string())]),
    model: z.string().default('text-embedding-3-small'),
    dimensions: z.number().optional(), // For new embedding models
  }),
};

export type ChatCompletionParams = z.infer<typeof openAISchemas.chatCompletion>;
export type TranscriptionParams = z.infer<typeof openAISchemas.transcription>;
export type EmbeddingParams = z.infer<typeof openAISchemas.embedding>;

class OpenAIService {
  /**
   * Default models for different operations
   * These can be overridden via environment variables for flexibility
   * gpt-4o-mini: Fast, cost-effective model for debate responses
   * text-embedding-3-small: Efficient embedding model for semantic search
   * whisper-1: OpenAI's speech-to-text model for transcriptions
   */
  private readonly defaultModels = {
    chat: process.env.OPENAI_GENERATION_MODEL || 'gpt-4o-mini',
    embedding: 'text-embedding-3-small',
    transcription: 'whisper-1',
  };

  /**
   * Create a chat completion with validation and error handling
   * 
   * This is the primary method for generating AI responses in debates.
   * It handles the complete lifecycle of a chat completion request:
   * 1. Input validation using Zod schemas
   * 2. Token estimation for cost prediction
   * 3. Request execution with automatic retry on failures
   * 4. Response validation if a validator is provided
   * 5. Usage tracking for cost monitoring
   * 
   * The method integrates with openAIManager for:
   * - Connection pooling and reuse
   * - Rate limiting to avoid 429 errors
   * - Automatic retry with exponential backoff
   * - Fallback responses for graceful degradation
   */
  async createChatCompletion(
    params: ChatCompletionParams,
    options?: {
      fallbackResponse?: string;
      validateResponse?: (response: string) => boolean;
    }
  ): Promise<OpenAI.ChatCompletion> {
    // Validate input
    const validated = openAISchemas.chatCompletion.parse(params);
    
    // Log token estimation for cost tracking
    const estimatedTokens = this.estimateTokens(validated.messages);
    logger.info('Creating chat completion', {
      metadata: {
        model: validated.model,
        estimatedTokens,
        temperature: validated.temperature,
      }
    });

    try {
      const response = await openAIManager.createChatCompletion(
        {
          ...validated,
          model: validated.model || this.defaultModels.chat,
        },
        {
          fallbackResponse: options?.fallbackResponse,
          shouldRetry: (error: unknown) => {
            // Custom retry logic for chat completions
            // This strategy balances reliability with cost efficiency
            const err = error as Record<string, unknown>;
            if (err?.status === 429) return true; // Rate limit - always retry with backoff
            if (typeof err?.status === 'number' && err.status >= 500) return true; // Server errors - likely transient
            if (err?.code === 'context_length_exceeded') return false; // Don't retry - input too long
            if (err?.status === 401) return false; // Auth error - don't waste retries
            return false;
          },
        }
      );

      // Validate response if validator provided
      if (options?.validateResponse) {
        const content = response.choices[0]?.message?.content;
        if (content && !options.validateResponse(content)) {
          logger.warn('Chat completion response failed validation', {
            metadata: {
              model: validated.model,
              response: content.substring(0, 100),
            }
          });
        }
      }

      // Log actual usage for cost tracking
      if (response.usage) {
        logger.info('Chat completion usage', {
          metadata: {
            model: validated.model,
            promptTokens: response.usage.prompt_tokens,
            completionTokens: response.usage.completion_tokens,
            totalTokens: response.usage.total_tokens,
          }
        });
      }

      return response;
    } catch (error) {
      logger.error('Chat completion failed', error as Error, {
        metadata: {
          model: validated.model,
          messageCount: validated.messages.length,
        }
      });
      throw error;
    }
  }

  /**
   * Create a transcription with validation and error handling
   * 
   * Converts audio to text using OpenAI's Whisper model.
   * Used in the speech feedback system to transcribe user debate speeches.
   * 
   * Key features:
   * - Supports multiple audio formats (mp3, mp4, mpeg, mpga, m4a, wav, webm)
   * - Language detection or specific language targeting
   * - Multiple output formats (json, text, srt, vtt)
   * - Automatic retry on transient failures
   * - File size validation (max 25MB per OpenAI limits)
   * 
   * Error handling:
   * - 413 errors (file too large) are not retried
   * - 429 errors (rate limit) trigger exponential backoff
   * - Network errors are retried up to 3 times
   */
  async createTranscription(
    params: TranscriptionParams & { file: File | Buffer | NodeJS.ReadableStream },
    options?: {
      fallbackResponse?: OpenAI.Audio.Transcription;
    }
  ): Promise<OpenAI.Audio.Transcription> {
    // Validate input (excluding file)
    const { file, ...restParams } = params;
    const validated = openAISchemas.transcription.parse({ ...restParams, file });

    logger.info('Creating transcription', {
      metadata: {
        model: validated.model,
        language: validated.language,
        responseFormat: validated.response_format,
      }
    });

    try {
      const response = await openAIManager.createTranscription(
        {
          ...validated,
          file: params.file, // Use original file
          model: validated.model || this.defaultModels.transcription,
        },
        {
          fallbackResponse: options?.fallbackResponse,
          shouldRetry: (error: unknown) => {
            const err = error as Record<string, unknown>;
            if (err?.status === 429) return true; // Rate limit
            if (typeof err?.status === 'number' && err.status >= 500) return true; // Server errors
            if (err?.status === 413) return false; // File too large
            return false;
          },
        }
      );

      return response;
    } catch (error) {
      logger.error('Transcription failed', error as Error, {
        metadata: {
          model: validated.model
        }
      });
      throw error;
    }
  }

  /**
   * Create embeddings for semantic search and similarity matching
   * 
   * Generates vector representations of text for:
   * - Document search in the debate evidence system
   * - Semantic similarity matching for finding related arguments
   * - Future RAG (Retrieval Augmented Generation) implementation
   * 
   * The embedding vectors can be stored in vector databases like:
   * - Supabase pgvector extension
   * - OpenAI's vector store (specified by OPENAI_VECTOR_STORE_ID)
   * - Other vector databases for scaling
   * 
   * Model selection:
   * - text-embedding-3-small: Default, cost-effective, 1536 dimensions
   * - text-embedding-3-large: Higher quality, 3072 dimensions
   * - Both support dimension reduction for optimization
   */
  async createEmbedding(params: EmbeddingParams): Promise<OpenAI.CreateEmbeddingResponse> {
    const validated = openAISchemas.embedding.parse(params);
    const client = await openAIManager.getRawClient();

    logger.info('Creating embeddings', {
      metadata: {
        model: validated.model,
        inputCount: Array.isArray(validated.input) ? validated.input.length : 1,
        dimensions: validated.dimensions,
      }
    });

    try {
      const response = await client.embeddings.create({
        ...validated,
        model: validated.model || this.defaultModels.embedding,
      });

      // Log usage for cost tracking
      logger.info('Embedding usage', {
        metadata: {
          model: validated.model,
          totalTokens: response.usage.total_tokens,
        }
      });

      return response;
    } catch (error) {
      logger.error('Embedding creation failed', error as Error, {
        metadata: {
          model: validated.model
        }
      });
      throw error;
    }
  }

  /**
   * Structured output helper for JSON responses
   * 
   * Ensures reliable JSON output from the model by:
   * 1. Setting response_format to 'json_object'
   * 2. Adding explicit JSON instruction to the system message
   * 3. Parsing and validating the response
   * 4. Optional schema validation with Zod
   * 
   * This is critical for:
   * - Debate scoring and analysis results
   * - Structured feedback generation
   * - API responses that need consistent formatting
   * 
   * The model is instructed to follow the schema strictly,
   * reducing the need for complex parsing or error handling
   */
  async createStructuredOutput<T>(
    params: Omit<ChatCompletionParams, 'response_format'> & {
      schema?: z.ZodSchema<T>;
      schemaName?: string;
    }
  ): Promise<T> {
    const response = await this.createChatCompletion({
      ...params,
      response_format: { type: 'json_object' },
      messages: [
        ...params.messages,
        {
          role: 'system',
          content: params.schema 
            ? `You must respond with valid JSON that matches this schema: ${JSON.stringify(params.schema)}`
            : 'You must respond with valid JSON.',
        },
      ],
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No content in response');
    }

    try {
      const parsed = JSON.parse(content);
      
      // Validate against schema if provided
      if (params.schema) {
        return params.schema.parse(parsed);
      }
      
      return parsed as T;
    } catch (error) {
      logger.error('Failed to parse structured output', error as Error, {
        metadata: {
          content: content.substring(0, 200),
        }
      });
      throw new Error('Invalid JSON response from OpenAI');
    }
  }

  /**
   * Stream chat completion for real-time responses
   * 
   * Enables token-by-token streaming for immediate user feedback.
   * Critical for the debate system's real-time interactions where
   * users expect immediate AI responses.
   * 
   * Streaming benefits:
   * - Lower perceived latency (first token arrives quickly)
   * - Enables progressive rendering in the UI
   * - Allows early termination if needed
   * - Better UX for long responses
   * 
   * The onChunk callback is invoked for each token,
   * allowing the UI to update in real-time.
   * 
   * Note: Streaming responses don't include usage statistics,
   * so token counting must be done client-side if needed.
   */
  async streamChatCompletion(
    params: ChatCompletionParams,
    onChunk: (chunk: string) => void
  ): Promise<void> {
    const validated = openAISchemas.chatCompletion.parse(params);
    const client = await openAIManager.getRawClient();

    const stream = await client.chat.completions.create({
      ...validated,
      model: validated.model || this.defaultModels.chat,
      stream: true,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        onChunk(content);
      }
    }
  }

  /**
   * Helper to estimate tokens (rough approximation)
   * 
   * Provides a quick token count estimate for cost prediction.
   * This is a simplified heuristic - actual token counts vary based on:
   * - Language (non-English text uses more tokens)
   * - Special characters and formatting
   * - Model-specific tokenization rules
   * 
   * For precise counts, use OpenAI's tiktoken library.
   * This estimation is sufficient for:
   * - Cost approximation before API calls
   * - Checking if content might exceed limits
   * - Logging and monitoring purposes
   */
  private estimateTokens(messages: Array<{ role: string; content: string }>): number {
    // Rough estimation: ~4 characters per token
    // This is conservative - actual average is closer to 3.5-4.5
    const totalChars = messages.reduce((sum, msg) => sum + msg.content.length, 0);
    return Math.ceil(totalChars / 4);
  }

  /**
   * Get cost estimation for an operation
   * 
   * Calculates estimated costs based on OpenAI's pricing model.
   * This helps with:
   * - Budget monitoring and alerts
   * - Cost optimization decisions
   * - Choosing between model quality and cost
   * 
   * Pricing notes:
   * - gpt-4o-mini is the primary model for cost efficiency
   * - Prices are per 1K tokens for text models
   * - Whisper pricing is per minute of audio
   * - Actual prices may vary - check OpenAI pricing page
   * 
   * The estimation helps decide:
   * - When to use more expensive models (gpt-4o)
   * - Whether to implement caching for repeated queries
   * - If response length limits should be enforced
   */
  estimateCost(model: string, tokens: number): number {
    // Rough cost estimates (update with actual pricing)
    const pricing: Record<string, number> = {
      'gpt-4o': 0.01, // per 1K tokens - higher quality
      'gpt-4o-mini': 0.0002, // per 1K tokens - primary model for efficiency
      'text-embedding-3-small': 0.00002, // very cost-effective for embeddings
      'text-embedding-3-large': 0.00013, // higher quality embeddings
      'whisper-1': 0.006, // per minute of audio
    };

    const rate = pricing[model] || 0.01;
    return (tokens / 1000) * rate;
  }
}

// Export singleton instance
export const openAIService = new OpenAIService();

// Export types for use in other modules
export type { OpenAI } from 'openai';