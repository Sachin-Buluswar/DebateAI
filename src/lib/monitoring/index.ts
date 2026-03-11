/**
 * Monitoring and observability exports
 * Central hub for all monitoring utilities
 */

// Logger exports
export {
  default as Logger,
  apiLogger,
  authLogger,
  aiLogger,
} from './logger';

// Performance monitoring exports
export {
  apiPerformance,
  dbPerformance,
  openaiPerformance,
  elevenLabsPerformance
} from './performance';

// Middleware exports
export {
  withMonitoring,
} from './middleware';

// OpenTelemetry exports
export {
  initializeOpenTelemetry,
  shutdownOpenTelemetry,
  createSpan,
  traceAsync,
  debateMetrics,
} from './opentelemetry';

/**
 * Initialize monitoring for the application
 * Call this in your app initialization
 */
export async function initializeMonitoring() {
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

      import('../../../sentry.server.config').then(({ sentryServer }) => {
        sentryServer.captureException(reason as Error);
      });
    });

    process.on('uncaughtException', (error) => {
      localApiLogger.fatal('Uncaught Exception', error, {
        metadata: { fatal: true }
      });

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

      import('../../../instrumentation-client').then(({ sentryClient }) => {
        sentryClient.captureException(new Error(event.reason));
      });
    });

    window.addEventListener('error', (event) => {
      console.error('Global error:', event.error);

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
