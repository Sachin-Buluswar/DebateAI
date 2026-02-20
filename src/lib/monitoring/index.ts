/**
 * Monitoring and observability exports
 * Central hub for all monitoring utilities
 */

// Logger exports
import { apiLogger as _apiLogger } from './logger';
export {
  default as Logger,
  apiLogger,
  dbLogger,
  authLogger,
  aiLogger,
  socketLogger
} from './logger';

// Error tracking exports
export {
  AppError,
  ErrorTypes,
  ErrorTracker,
  apiErrorTracker,
  dbErrorTracker,
  aiErrorTracker
} from './errorTracker';

// Performance monitoring exports
export {
  PerformanceMonitor,
  DatabasePerformanceTracker,
  ExternalAPIPerformanceTracker,
  apiPerformance,
  dbPerformance,
  openaiPerformance,
  elevenLabsPerformance
} from './performance';

// Middleware exports
export {
  withMonitoring,
  withRateLimit,
  composeMiddleware,
  RateLimitTracker
} from './middleware';

// OpenTelemetry exports
export {
  initializeOpenTelemetry,
  shutdownOpenTelemetry,
  createSpan,
  traceAsync,
  traceSync,
  addSpanEvent,
  setSpanAttributes,
  instrumentSocketIO,
  debateMetrics,
  recordDebateStart,
  recordDebateEnd,
  recordAIResponse,
  recordError
} from './opentelemetry';

// Socket monitoring exports
export {
  SocketMonitor,
  createMonitoredSocketServer
} from './socketMonitor';

// Type exports
export type { ErrorDetails } from './errorTracker';

/**
 * Initialize monitoring for the application
 * Call this in your app initialization
 */
export async function initializeMonitoring() {
  // Import logger within function
  const { apiLogger: localApiLogger } = await import('./logger');
  const { initializeOpenTelemetry: initOtel } = await import('./opentelemetry');

  // Initialize OpenTelemetry
  initOtel();

  // Set up global error handlers
  if (typeof window === 'undefined') {
    // Server-side error handling
    process.on('unhandledRejection', (reason, promise) => {
      localApiLogger.fatal('Unhandled Promise Rejection', reason as Error, {
        metadata: { promise: promise.toString() }
      });

      // Also capture in Sentry
      import('../../../sentry.server.config').then(({ sentryServer }) => {
        sentryServer.captureException(reason as Error);
      });
    });

    process.on('uncaughtException', (error) => {
      localApiLogger.fatal('Uncaught Exception', error, {
        metadata: { fatal: true }
      });

      // Also capture in Sentry
      import('../../../sentry.server.config').then(({ sentryServer }) => {
        sentryServer.captureException(error);
      });

      // Give the logger time to flush before exiting
      setTimeout(() => process.exit(1), 1000);
    });
  } else {
    // Client-side error handling
    window.addEventListener('unhandledrejection', (event) => {
      console.error('Unhandled promise rejection:', event.reason);

      // Also capture in Sentry
      import('../../../instrumentation-client').then(({ sentryClient }) => {
        sentryClient.captureException(new Error(event.reason));
      });
    });

    window.addEventListener('error', (event) => {
      console.error('Global error:', event.error);

      // Also capture in Sentry
      import('../../../instrumentation-client').then(({ sentryClient }) => {
        sentryClient.captureException(event.error);
      });
    });
  }

  // Log initialization
  localApiLogger.info('Monitoring initialized', {
    metadata: {
      environment: process.env.NODE_ENV,
      logLevel: process.env.LOG_LEVEL || 'info',
      openTelemetryEnabled: !!process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
      sentryEnabled: !!process.env.SENTRY_DSN
    }
  });
}

/**
 * Utility function to measure async operation performance
 */
export async function measure<T>(
  name: string,
  operation: () => Promise<T>,
  logger?: { info: (msg: string, ctx?: Record<string, unknown>) => void; error: (msg: string, err?: Error, ctx?: Record<string, unknown>) => void }
): Promise<T> {
  const { apiLogger: defaultLogger } = await import('./logger');
  const { traceAsync: traceAsyncFn } = await import('./opentelemetry');
  const log = logger || defaultLogger;
  const start = Date.now();

  // Use OpenTelemetry tracing if available
  if (process.env.OTEL_EXPORTER_OTLP_ENDPOINT) {
    return traceAsyncFn(name, operation);
  }

  try {
    const result = await operation();
    const duration = Date.now() - start;

    log.info(`Operation completed: ${name}`, {
      metadata: { duration: `${duration}ms` }
    });

    return result;
  } catch (error) {
    const duration = Date.now() - start;

    log.error(`Operation failed: ${name}`, error as Error, {
      metadata: { duration: `${duration}ms` }
    });

    throw error;
  }
}

/**
 * Create a context-aware logger for a specific request
 */
export function createRequestLogger(
  requestId: string,
  userId?: string,
  metadata?: Record<string, unknown>
): import('./logger').default {
  return _apiLogger.child({
    requestId,
    userId,
    metadata
  });
}

/**
 * Gracefully shutdown monitoring systems
 */
export async function shutdownMonitoring() {
  const { shutdownOpenTelemetry: shutdownOtel } = await import('./opentelemetry');
  const { apiLogger: localApiLogger } = await import('./logger');

  localApiLogger.info('Shutting down monitoring systems');

  try {
    await shutdownOtel();
    localApiLogger.info('Monitoring shutdown complete');
  } catch (error) {
    localApiLogger.error('Error during monitoring shutdown', error as Error);
  }
}
