/**
 * Input Validation Middleware for DebateAI
 * Provides comprehensive input sanitization and validation
 */

import { z } from 'zod';
import { MAX_UPLOAD_SIZE_BYTES, MAX_RECORDING_MINUTES } from '@/shared/constants';

// Common validation schemas
export const commonSchemas = {
  uuid: z.string().uuid('Invalid UUID format'),
  email: z.string().email('Invalid email format'),
  nonEmptyString: z.string().min(1, 'Field cannot be empty'),
  safeString: z.string().max(1000, 'Text too long').regex(
    /^[a-zA-Z0-9\s\-_.,!?'"()[\]{}:;@#$%&*+=<>\/\\]*$/,
    'Contains invalid characters'
  ),
  debateTopic: z.string()
    .min(10, 'Topic must be at least 10 characters')
    .max(500, 'Topic too long')
    .regex(
      /^[a-zA-Z0-9\s\-_.,!?'"()[\]{}:;@#$%&*+=<>\/\\]*$/,
      'Topic contains invalid characters'
    ),
  speechType: z.enum(['debate', 'presentation', 'speech', 'constructive', 'rebuttal', 'cross-examination', 'summary', 'final-focus'], {
    errorMap: () => ({ message: 'Invalid speech type' })
  }),
  audioMimeType: z.enum(['audio/mpeg', 'audio/wav', 'audio/mp3', 'audio/ogg', 'audio/webm', 'audio/aac', 'audio/flac', 'audio/m4a', 'audio/x-m4a'], {
    errorMap: () => ({ message: 'Unsupported audio format' })
  }),
};

// Specific validation schemas for different endpoints
export const validationSchemas = {
  wikiSearch: z.object({
    query: commonSchemas.safeString.min(3, 'Search query too short'),
    maxResults: z.number().int().min(1).max(20).optional(),
  }),

  speechFeedback: z.object({
    topic: commonSchemas.debateTopic,
    speechTypes: z.string().optional(),
    userSide: z.enum(['Proposition', 'Opposition', 'None']).optional(),
    customInstructions: commonSchemas.safeString.optional(),
    userId: commonSchemas.uuid,
  }),

  debateSetup: z.object({
    topic: commonSchemas.debateTopic,
    userSide: z.enum(['pro', 'con']),
    selectedDebaters: z.array(z.string()).min(1).max(3),
    hasAIPartner: z.boolean().optional(),
    difficultyLevel: z.enum(['beginner', 'intermediate', 'advanced']).optional(),
  }),

  userProfile: z.object({
    displayName: commonSchemas.safeString.min(2).max(50).optional(),
    email: commonSchemas.email.optional(),
    preferences: z.object({
      theme: z.enum(['light', 'dark', 'system']).optional(),
      notifications: z.boolean().optional(),
      autoplay: z.boolean().optional(),
    }).optional(),
  }),
};

// File validation for uploads
export const fileValidation = {
  audio: {
    maxSize: MAX_UPLOAD_SIZE_BYTES,
    allowedTypes: ['audio/mpeg', 'audio/wav', 'audio/mp3', 'audio/ogg', 'audio/webm', 'audio/aac', 'audio/flac', 'audio/m4a', 'audio/x-m4a'],
    maxDuration: MAX_RECORDING_MINUTES * 60, // Convert minutes to seconds
  },
};

// Sanitization functions
export class InputSanitizer {
  static sanitizeHtml(input: string): string {
    // Basic HTML/XSS prevention
    return input
      .replace(/[<>]/g, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+=/gi, '')
      .replace(/eval\(/gi, '')
      .replace(/expression\(/gi, '');
  }

  static sanitizeFilename(filename: string): string {
    return filename
      .replace(/[^a-zA-Z0-9.-]/g, '_')
      .replace(/\.{2,}/g, '.')
      .substring(0, 255);
  }

  static sanitizeSearchQuery(query: string): string {
    // Remove potentially dangerous patterns while preserving search functionality
    return query
      .replace(/[<>]/g, '')
      .replace(/javascript:/gi, '')
      .replace(/[\x00-\x1f\x7f]/g, '') // Remove control characters
      .trim();
  }

  static validateAndSanitizeJson(jsonString: string, maxDepth: number = 5): unknown {
    try {
      const parsed = JSON.parse(jsonString);
      return this.sanitizeObject(parsed, maxDepth);
    } catch {
      throw new Error('Invalid JSON format');
    }
  }

  static sanitizeObject(obj: unknown, depth: number): unknown {
    if (depth <= 0) {
      throw new Error('Object nesting too deep');
    }

    if (typeof obj === 'string') {
      return this.sanitizeHtml(obj);
    }

    if (Array.isArray(obj)) {
      if (obj.length > 100) {
        throw new Error('Array too large');
      }
      return obj.map(item => this.sanitizeObject(item, depth - 1));
    }

    if (obj && typeof obj === 'object') {
      const keys = Object.keys(obj);
      if (keys.length > 50) {
        throw new Error('Object has too many properties');
      }

      const sanitized: Record<string, unknown> = {};
      for (const key of keys) {
        const sanitizedKey = this.sanitizeHtml(key);
        sanitized[sanitizedKey] = this.sanitizeObject((obj as Record<string, unknown>)[key], depth - 1);
      }
      return sanitized;
    }

    return obj;
  }
}

// Validation middleware for API routes
export async function validateRequest<T>(
  req: Request,
  schema: z.ZodSchema<T>,
  options: {
    body?: boolean;
    query?: boolean;
    sanitize?: boolean;
  } = { body: true, sanitize: true }
): Promise<{ success: true; data: T } | { success: false; error: string; details?: unknown }> {
  try {
    let data: Record<string, unknown> = {};

    if (options.body) {
      const contentType = req.headers.get('content-type');
      
      if (contentType?.includes('application/json')) {
        const body = await req.text();
        if (options.sanitize) {
          data = InputSanitizer.validateAndSanitizeJson(body) as Record<string, unknown>;
        } else {
          data = JSON.parse(body) as Record<string, unknown>;
        }
      } else if (contentType?.includes('multipart/form-data')) {
        const formData = await req.formData();
        data = {};
        for (const [key, value] of formData.entries()) {
          if (typeof value === 'string') {
            data[key] = options.sanitize ? InputSanitizer.sanitizeHtml(value) : value;
          } else {
            data[key] = value; // File or Blob
          }
        }
      } else if (contentType?.includes('application/x-www-form-urlencoded')) {
        const formData = await req.formData();
        data = Object.fromEntries(formData.entries());
        if (options.sanitize) {
          data = InputSanitizer.sanitizeObject(data, 3) as Record<string, unknown>;
        }
      }
    }

    if (options.query) {
      const url = new URL(req.url);
      const queryData: Record<string, unknown> = {};
      for (const [key, value] of url.searchParams.entries()) {
        queryData[key] = options.sanitize ? InputSanitizer.sanitizeHtml(value) : value;
      }
      data = { ...data, ...queryData };
    }

    const result = schema.safeParse(data);
    
    if (!result.success) {
      return {
        success: false,
        error: 'Validation failed',
        details: result.error.flatten(),
      };
    }

    return {
      success: true,
      data: result.data,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Validation error',
    };
  }
}

// File validation helper
export function validateAudioFile(file: File): { valid: boolean; error?: string } {
  if (file.size > fileValidation.audio.maxSize) {
    return {
      valid: false,
      error: `File too large. Maximum size is ${fileValidation.audio.maxSize / 1024 / 1024}MB`,
    };
  }

  if (!fileValidation.audio.allowedTypes.includes(file.type)) {
    return {
      valid: false,
      error: `Unsupported file type. Allowed types: ${fileValidation.audio.allowedTypes.join(', ')}`,
    };
  }

  return { valid: true };
}

// Security headers helper
export function addSecurityHeaders(response: Response): Response {
  const headers = new Headers(response.headers);
  
  // Basic security headers
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('X-Frame-Options', 'DENY');
  headers.set('X-XSS-Protection', '1; mode=block');
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  headers.set('Permissions-Policy', 'camera=(), microphone=(self), geolocation=()');
  
  // Remove potentially sensitive headers
  headers.delete('Server');
  headers.delete('X-Powered-By');

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

// CORS configuration for production
export const corsConfig = {
  allowedOrigins: [
    'https://debateai.com',
    'https://www.debateai.com',
    'https://app.debateai.com',
    ...(process.env.NODE_ENV === 'development' ? ['http://localhost:3001'] : []),
  ],
  allowedMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'Accept',
    'Origin',
  ],
  credentials: true,
};

export function validateCorsOrigin(origin: string | null): boolean {
  if (!origin) return false;
  return corsConfig.allowedOrigins.includes(origin);
}