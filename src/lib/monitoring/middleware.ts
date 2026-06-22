/**
 * Monitoring middleware for Next.js API routes
 * Integrates logging, error tracking, and performance monitoring
 */

import { NextRequest, NextResponse } from 'next/server';
import { apiLogger } from './logger';
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
    startTime: Date.now(),
  };
}

/**
 * Monitoring middleware wrapper for API routes
 */
export function withMonitoring(
  handler: (request: NextRequest, context?: Record<string, unknown>) => Promise<NextResponse>
) {
  return async (request: NextRequest, context?: Record<string, unknown>): Promise<NextResponse> => {
    const monitoringContext = createContext(request);
    const { pathname } = new URL(request.url);
    const method = request.method;

    // Start performance timer
    apiPerformance.startTimer(`${method} ${pathname}`, {
      requestId: monitoringContext.requestId,
      userId: monitoringContext.userId,
    });

    // Log incoming request
    apiLogger.info(`Incoming request: ${method} ${pathname}`, {
      requestId: monitoringContext.requestId,
      userId: monitoringContext.userId,
      sessionId: monitoringContext.sessionId,
      metadata: {
        userAgent: request.headers.get('user-agent'),
        referer: request.headers.get('referer'),
        ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip'),
      },
    });

    try {
      // Execute the handler
      const response = await handler(request, context);

      // End performance timer
      const duration = apiPerformance.endTimer(`${method} ${pathname}`, {
        status: response.status,
        ok: response.ok,
      });

      // Log successful response
      apiLogger.info(`Request completed: ${method} ${pathname}`, {
        requestId: monitoringContext.requestId,
        metadata: {
          status: response.status,
          duration: duration?.toFixed(2) + 'ms',
        },
      });

      // Add monitoring headers to response
      const headers = new Headers(response.headers);
      headers.set('X-Request-ID', monitoringContext.requestId);
      headers.set('X-Response-Time', `${duration?.toFixed(2)}ms`);

      return new NextResponse(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    } catch (error) {
      // End performance timer with error
      apiPerformance.endTimer(`${method} ${pathname}`, {
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      // Log error
      apiLogger.error(`Request failed: ${method} ${pathname}`, error as Error, {
        requestId: monitoringContext.requestId,
        userId: monitoringContext.userId,
        sessionId: monitoringContext.sessionId,
        metadata: { path: pathname, method },
      });

      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  };
}
