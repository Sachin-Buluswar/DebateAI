/**
 * Monitoring middleware for Next.js API routes
 * Integrates logging, error tracking, and performance monitoring
 */

import { NextRequest, NextResponse } from 'next/server';
import { apiLogger } from './logger';
import { apiErrorTracker, AppError } from './errorTracker';
import { apiPerformance } from './performance';

interface MonitoringContext {
  requestId: string;
  userId?: string;
  sessionId?: string;
  startTime: number;
}

/**
 * Create monitoring context from request
 */
function createContext(request: NextRequest): MonitoringContext {
  const requestId = crypto.randomUUID();
  const userId = request.headers.get('x-user-id') || undefined;
  const sessionId = request.headers.get('x-session-id') || undefined;
  
  return {
    requestId,
    userId,
    sessionId,
    startTime: Date.now()
  };
}

/**
 * Monitoring middleware wrapper for API routes
 */
export function withMonitoring(
  handler: (request: NextRequest, context?: any) => Promise<NextResponse>
) {
  return async (request: NextRequest, context?: any): Promise<NextResponse> => {
    const monitoringContext = createContext(request);
    const { pathname } = new URL(request.url);
    const method = request.method;
    
    // Start performance timer
    apiPerformance.startTimer(`${method} ${pathname}`, {
      requestId: monitoringContext.requestId,
      userId: monitoringContext.userId
    });
    
    // Log incoming request
    apiLogger.info(`Incoming request: ${method} ${pathname}`, {
      requestId: monitoringContext.requestId,
      userId: monitoringContext.userId,
      sessionId: monitoringContext.sessionId,
      metadata: {
        userAgent: request.headers.get('user-agent'),
        referer: request.headers.get('referer'),
        ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip')
      }
    });
    
    try {
      // Execute the handler
      const response = await handler(request, context);
      
      // End performance timer
      const duration = apiPerformance.endTimer(`${method} ${pathname}`, {
        status: response.status,
        ok: response.ok
      });
      
      // Log successful response
      apiLogger.info(`Request completed: ${method} ${pathname}`, {
        requestId: monitoringContext.requestId,
        metadata: {
          status: response.status,
          duration: duration?.toFixed(2) + 'ms'
        }
      });
      
      // Add monitoring headers to response
      const headers = new Headers(response.headers);
      headers.set('X-Request-ID', monitoringContext.requestId);
      headers.set('X-Response-Time', `${duration?.toFixed(2)}ms`);
      
      return new NextResponse(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers
      });
      
    } catch (error) {
      // End performance timer with error
      apiPerformance.endTimer(`${method} ${pathname}`, {
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      // Log and track error
      return apiErrorTracker.track(error as Error, {
        requestId: monitoringContext.requestId,
        userId: monitoringContext.userId,
        sessionId: monitoringContext.sessionId,
        path: pathname,
        method
      });
    }
  };
}

/**
 * Rate limiting tracker
 */
export class RateLimitTracker {
  private attempts: Map<string, number[]> = new Map();
  private windowMs: number;
  private maxAttempts: number;

  constructor(windowMs: number = 60000, maxAttempts: number = 10) {
    this.windowMs = windowMs;
    this.maxAttempts = maxAttempts;
  }

  track(identifier: string): boolean {
    const now = Date.now();
    const attempts = this.attempts.get(identifier) || [];
    
    // Remove old attempts outside the window
    const validAttempts = attempts.filter(time => now - time < this.windowMs);
    
    // Check if rate limit exceeded
    if (validAttempts.length >= this.maxAttempts) {
      apiLogger.warn('Rate limit exceeded', {
        metadata: {
          identifier,
          attempts: validAttempts.length,
          window: this.windowMs
        }
      });
      return false;
    }
    
    // Add new attempt
    validAttempts.push(now);
    this.attempts.set(identifier, validAttempts);
    
    return true;
  }

  reset(identifier: string): void {
    this.attempts.delete(identifier);
  }

  cleanup(): void {
    const now = Date.now();
    for (const [identifier, attempts] of this.attempts.entries()) {
      const validAttempts = attempts.filter(time => now - time < this.windowMs);
      if (validAttempts.length === 0) {
        this.attempts.delete(identifier);
      } else {
        this.attempts.set(identifier, validAttempts);
      }
    }
  }
}

/**
 * Create rate limiting middleware
 */
export function withRateLimit(
  options: {
    windowMs?: number;
    maxAttempts?: number;
    identifier?: (req: NextRequest) => string;
  } = {}
) {
  const tracker = new RateLimitTracker(options.windowMs, options.maxAttempts);
  
  // Cleanup old entries periodically
  setInterval(() => tracker.cleanup(), 60000); // Every minute
  
  return function(
    handler: (request: NextRequest, context?: any) => Promise<NextResponse>
  ) {
    return async (request: NextRequest, context?: any): Promise<NextResponse> => {
      // Get identifier (default to IP address)
      const identifier = options.identifier
        ? options.identifier(request)
        : request.headers.get('x-forwarded-for') || 
          request.headers.get('x-real-ip') || 
          'unknown';
      
      // Check rate limit
      if (!tracker.track(identifier)) {
        return NextResponse.json(
          {
            error: {
              code: 'RATE_LIMITED',
              message: 'Too many requests. Please try again later.'
            }
          },
          {
            status: 429,
            headers: {
              'Retry-After': '60',
              'X-RateLimit-Limit': String(options.maxAttempts || 10),
              'X-RateLimit-Remaining': '0',
              'X-RateLimit-Reset': String(Date.now() + (options.windowMs || 60000))
            }
          }
        );
      }
      
      return handler(request, context);
    };
  };
}

/**
 * Combine multiple middleware functions
 */
export function composeMiddleware(
  ...middlewares: Array<(handler: any) => any>
) {
  return function(handler: any) {
    return middlewares.reduceRight((acc, middleware) => middleware(acc), handler);
  };
}

/**
 * Example usage:
 * 
 * export const GET = composeMiddleware(
 *   withMonitoring,
 *   withRateLimit({ maxAttempts: 5, windowMs: 60000 })
 * )(async (request: NextRequest) => {
 *   // Your API logic here
 *   return NextResponse.json({ success: true });
 * });
 */