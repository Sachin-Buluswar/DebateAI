/**
 * Error tracking and recovery system
 * Handles different types of errors with appropriate responses
 */

import { NextResponse } from 'next/server';
import Logger from './logger';

export interface ErrorDetails {
  code: string;
  message: string;
  statusCode: number;
  retryable: boolean;
  userMessage?: string;
  metadata?: Record<string, any>;
}

export class AppError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly retryable: boolean;
  public readonly userMessage?: string;
  public readonly metadata?: Record<string, any>;

  constructor(details: ErrorDetails) {
    super(details.message);
    this.name = 'AppError';
    this.code = details.code;
    this.statusCode = details.statusCode;
    this.retryable = details.retryable;
    this.userMessage = details.userMessage;
    this.metadata = details.metadata;
  }
}

// Common error types
export const ErrorTypes = {
  // Authentication errors
  UNAUTHORIZED: {
    code: 'AUTH_UNAUTHORIZED',
    message: 'Authentication required',
    statusCode: 401,
    retryable: false,
    userMessage: 'Please log in to continue'
  },
  FORBIDDEN: {
    code: 'AUTH_FORBIDDEN',
    message: 'Access forbidden',
    statusCode: 403,
    retryable: false,
    userMessage: 'You do not have permission to access this resource'
  },
  
  // Validation errors
  INVALID_INPUT: {
    code: 'VALIDATION_INVALID_INPUT',
    message: 'Invalid input provided',
    statusCode: 400,
    retryable: false,
    userMessage: 'Please check your input and try again'
  },
  MISSING_REQUIRED_FIELD: {
    code: 'VALIDATION_MISSING_FIELD',
    message: 'Required field missing',
    statusCode: 400,
    retryable: false
  },
  
  // Resource errors
  NOT_FOUND: {
    code: 'RESOURCE_NOT_FOUND',
    message: 'Resource not found',
    statusCode: 404,
    retryable: false,
    userMessage: 'The requested resource could not be found'
  },
  CONFLICT: {
    code: 'RESOURCE_CONFLICT',
    message: 'Resource conflict',
    statusCode: 409,
    retryable: true
  },
  
  // External service errors
  EXTERNAL_SERVICE_ERROR: {
    code: 'EXTERNAL_SERVICE_ERROR',
    message: 'External service error',
    statusCode: 503,
    retryable: true,
    userMessage: 'Service temporarily unavailable. Please try again later'
  },
  OPENAI_ERROR: {
    code: 'AI_SERVICE_ERROR',
    message: 'AI service error',
    statusCode: 503,
    retryable: true,
    userMessage: 'AI service is temporarily unavailable'
  },
  ELEVENLABS_ERROR: {
    code: 'TTS_SERVICE_ERROR',
    message: 'Text-to-speech service error',
    statusCode: 503,
    retryable: true,
    userMessage: 'Voice synthesis is temporarily unavailable'
  },
  
  // Rate limiting
  RATE_LIMITED: {
    code: 'RATE_LIMITED',
    message: 'Too many requests',
    statusCode: 429,
    retryable: true,
    userMessage: 'Too many requests. Please slow down and try again'
  },
  
  // Database errors
  DATABASE_ERROR: {
    code: 'DATABASE_ERROR',
    message: 'Database operation failed',
    statusCode: 500,
    retryable: true,
    userMessage: 'A database error occurred. Please try again'
  },
  
  // Generic errors
  INTERNAL_ERROR: {
    code: 'INTERNAL_ERROR',
    message: 'Internal server error',
    statusCode: 500,
    retryable: true,
    userMessage: 'An unexpected error occurred. Please try again later'
  }
};

export class ErrorTracker {
  private logger: Logger;
  private isDevelopment: boolean;

  constructor(serviceName: string) {
    this.logger = new Logger(`error-tracker:${serviceName}`);
    this.isDevelopment = process.env.NODE_ENV !== 'production';
  }

  /**
   * Track and handle errors with appropriate logging and response
   */
  track(error: Error | AppError, context?: any): NextResponse {
    // Determine error details
    let errorDetails: ErrorDetails;
    
    if (error instanceof AppError) {
      errorDetails = {
        code: error.code,
        message: error.message,
        statusCode: error.statusCode,
        retryable: error.retryable,
        userMessage: error.userMessage,
        metadata: error.metadata
      };
    } else {
      // Map common errors to our error types
      errorDetails = this.mapError(error);
    }

    // Log the error
    this.logger.error(
      `Error: ${errorDetails.code}`,
      error,
      {
        metadata: {
          ...errorDetails.metadata,
          ...context
        }
      }
    );

    // Create response
    const response: any = {
      error: {
        code: errorDetails.code,
        message: errorDetails.userMessage || errorDetails.message
      }
    };

    // Add debug info in development
    if (this.isDevelopment) {
      response.error.details = {
        message: error.message,
        stack: error.stack,
        metadata: errorDetails.metadata
      };
    }

    // Add retry headers if applicable
    const headers: Record<string, string> = {};
    if (errorDetails.retryable) {
      headers['Retry-After'] = '60'; // 60 seconds
    }

    return NextResponse.json(response, {
      status: errorDetails.statusCode,
      headers
    });
  }

  /**
   * Map generic errors to our error types
   */
  private mapError(error: Error): ErrorDetails {
    const errorMessage = error.message.toLowerCase();
    
    // OpenAI errors
    if (errorMessage.includes('openai') || errorMessage.includes('gpt')) {
      return {
        ...ErrorTypes.OPENAI_ERROR,
        metadata: { originalError: error.message }
      };
    }
    
    // ElevenLabs errors
    if (errorMessage.includes('elevenlabs') || errorMessage.includes('tts')) {
      return {
        ...ErrorTypes.ELEVENLABS_ERROR,
        metadata: { originalError: error.message }
      };
    }
    
    // Database errors
    if (errorMessage.includes('database') || errorMessage.includes('supabase')) {
      return {
        ...ErrorTypes.DATABASE_ERROR,
        metadata: { originalError: error.message }
      };
    }
    
    // Rate limiting
    if (errorMessage.includes('rate limit') || errorMessage.includes('too many')) {
      return {
        ...ErrorTypes.RATE_LIMITED,
        metadata: { originalError: error.message }
      };
    }
    
    // Default to internal error
    return {
      ...ErrorTypes.INTERNAL_ERROR,
      metadata: { originalError: error.message }
    };
  }

  /**
   * Create a standardized error response
   */
  static createErrorResponse(
    error: ErrorDetails,
    additionalData?: any
  ): NextResponse {
    const response: any = {
      error: {
        code: error.code,
        message: error.userMessage || error.message
      }
    };

    if (additionalData) {
      response.error.data = additionalData;
    }

    return NextResponse.json(response, {
      status: error.statusCode
    });
  }

  /**
   * Wrap an async handler with error tracking
   */
  wrapHandler(
    handler: (req: Request, context?: any) => Promise<NextResponse>
  ) {
    return async (req: Request, context?: any): Promise<NextResponse> => {
      try {
        return await handler(req, context);
      } catch (error) {
        return this.track(error as Error, { url: req.url, method: req.method });
      }
    };
  }
}

// Export singleton instances for common services
export const apiErrorTracker = new ErrorTracker('api');
export const dbErrorTracker = new ErrorTracker('database');
export const aiErrorTracker = new ErrorTracker('ai');