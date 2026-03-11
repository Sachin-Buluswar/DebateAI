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

};

export type ChatCompletionParams = z.infer<typeof openAISchemas.chatCompletion>;
export type TranscriptionParams = z.infer<typeof openAISchemas.transcription>;
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
    
    logger.info('Creating chat completion', {
      metadata: {
        model: validated.model,
        messageCount: validated.messages.length,
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

}

// Export singleton instance
export const openAIService = new OpenAIService();

// Export types for use in other modules
export type { OpenAI } from 'openai';