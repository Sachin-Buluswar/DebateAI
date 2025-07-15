/**
 * Monitoring and observability exports
 * Central hub for all monitoring utilities
 */

// Logger exports
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
export function initializeMonitoring() {
  // Import logger within function
  const { apiLogger } = require('./logger');
  const { initializeOpenTelemetry } = require('./opentelemetry');
  
  // Initialize OpenTelemetry
  initializeOpenTelemetry();
  
  // Set up global error handlers
  if (typeof window === 'undefined') {
    // Server-side error handling
    process.on('unhandledRejection', (reason, promise) => {
      apiLogger.fatal('Unhandled Promise Rejection', reason as Error, {
        metadata: { promise: promise.toString() }
      });
      
      // Also capture in Sentry
      const { sentryServer } = require('../../../sentry.server.config');
      sentryServer.captureException(reason as Error);
    });

    process.on('uncaughtException', (error) => {
      apiLogger.fatal('Uncaught Exception', error, {
        metadata: { fatal: true }
      });
      
      // Also capture in Sentry
      const { sentryServer } = require('../../../sentry.server.config');
      sentryServer.captureException(error);
      
      // Give the logger time to flush before exiting
      setTimeout(() => process.exit(1), 1000);
    });
  } else {
    // Client-side error handling
    window.addEventListener('unhandledrejection', (event) => {
      console.error('Unhandled promise rejection:', event.reason);
      
      // Also capture in Sentry
      const { sentryClient } = require('../../../sentry.client.config');
      sentryClient.captureException(new Error(event.reason));
    });

    window.addEventListener('error', (event) => {
      console.error('Global error:', event.error);
      
      // Also capture in Sentry
      const { sentryClient } = require('../../../sentry.client.config');
      sentryClient.captureException(event.error);
    });
  }

  // Log initialization
  apiLogger.info('Monitoring initialized', {
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
  logger?: any
): Promise<T> {
  const { apiLogger: defaultLogger } = require('./logger');
  const { traceAsync } = require('./opentelemetry');
  const log = logger || defaultLogger;
  const start = Date.now();
  
  // Use OpenTelemetry tracing if available
  if (process.env.OTEL_EXPORTER_OTLP_ENDPOINT) {
    return traceAsync(name, operation);
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
  metadata?: Record<string, any>
): any {
  const { apiLogger: logger } = require('./logger');
  return logger.child({
    requestId,
    userId,
    metadata
  });
}

/**
 * Gracefully shutdown monitoring systems
 */
export async function shutdownMonitoring() {
  const { shutdownOpenTelemetry } = require('./opentelemetry');
  const { apiLogger } = require('./logger');
  
  apiLogger.info('Shutting down monitoring systems');
  
  try {
    await shutdownOpenTelemetry();
    apiLogger.info('Monitoring shutdown complete');
  } catch (error) {
    apiLogger.error('Error during monitoring shutdown', error as Error);
  }
}