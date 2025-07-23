import { z } from 'zod';
import { openAIManager } from './openaiClientManager';
import { aiLogger as logger } from '@/lib/monitoring/logger';
import { env } from '@/shared/env';
import type { OpenAI } from 'openai';

/**
 * OpenAI Service - High-level interface for all OpenAI operations
 * 
 * Features:
 * - Centralized configuration management
 * - Built-in validation with Zod schemas
 * - Standardized error handling
 * - Performance monitoring
 * - Cost tracking hooks
 */

// Validation schemas for OpenAI operations
export const openAISchemas = {
  chatCompletion: z.object({
    messages: z.array(z.object({
      role: z.enum(['system', 'user', 'assistant']),
      content: z.string().min(1).max(32000), // OpenAI token limit approximation
    })),
    model: z.string().default('gpt-4o-mini'),
    temperature: z.number().min(0).max(2).optional(),
    max_tokens: z.number().min(1).max(4096).optional(),
    response_format: z.object({
      type: z.enum(['text', 'json_object']),
    }).optional(),
    frequency_penalty: z.number().min(-2).max(2).optional(),
    presence_penalty: z.number().min(-2).max(2).optional(),
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
  private readonly defaultModels = {
    chat: process.env.OPENAI_GENERATION_MODEL || 'gpt-4o-mini',
    embedding: 'text-embedding-3-small',
    transcription: 'whisper-1',
  };

  /**
   * Create a chat completion with validation and error handling
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
          shouldRetry: (error: any) => {
            // Custom retry logic for chat completions
            if (error?.status === 429) return true; // Rate limit
            if (error?.status >= 500) return true; // Server errors
            if (error?.code === 'context_length_exceeded') return false; // Don't retry
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
   */
  async createTranscription(
    params: TranscriptionParams & { file: File | Buffer | any },
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
          shouldRetry: (error: any) => {
            if (error?.status === 429) return true; // Rate limit
            if (error?.status >= 500) return true; // Server errors
            if (error?.status === 413) return false; // File too large
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
   * Create embeddings (for future use with vector stores)
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
   */
  private estimateTokens(messages: Array<{ role: string; content: string }>): number {
    // Rough estimation: ~4 characters per token
    const totalChars = messages.reduce((sum, msg) => sum + msg.content.length, 0);
    return Math.ceil(totalChars / 4);
  }

  /**
   * Get cost estimation for an operation
   */
  estimateCost(model: string, tokens: number): number {
    // Rough cost estimates (update with actual pricing)
    const pricing: Record<string, number> = {
      'gpt-4o': 0.01, // per 1K tokens
      'gpt-4o-mini': 0.0002, // per 1K tokens - primary model
      'text-embedding-3-small': 0.00002,
      'text-embedding-3-large': 0.00013,
      'whisper-1': 0.006, // per minute
    };

    const rate = pricing[model] || 0.01;
    return (tokens / 1000) * rate;
  }
}

// Export singleton instance
export const openAIService = new OpenAIService();

// Export types for use in other modules
export type { OpenAI } from 'openai';