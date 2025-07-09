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

// Type exports
export type { ErrorDetails } from './errorTracker';

/**
 * Initialize monitoring for the application
 * Call this in your app initialization
 */
export function initializeMonitoring() {
  // Import logger within function
  const { apiLogger } = require('./logger');
  
  // Set up global error handlers
  if (typeof window === 'undefined') {
    // Server-side error handling
    process.on('unhandledRejection', (reason, promise) => {
      apiLogger.fatal('Unhandled Promise Rejection', reason as Error, {
        metadata: { promise: promise.toString() }
      });
    });

    process.on('uncaughtException', (error) => {
      apiLogger.fatal('Uncaught Exception', error, {
        metadata: { fatal: true }
      });
      // Give the logger time to flush before exiting
      setTimeout(() => process.exit(1), 1000);
    });
  } else {
    // Client-side error handling
    window.addEventListener('unhandledrejection', (event) => {
      console.error('Unhandled promise rejection:', event.reason);
    });

    window.addEventListener('error', (event) => {
      console.error('Global error:', event.error);
    });
  }

  // Log initialization
  apiLogger.info('Monitoring initialized', {
    metadata: {
      environment: process.env.NODE_ENV,
      logLevel: process.env.LOG_LEVEL || 'info'
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
  const log = logger || defaultLogger;
  const start = Date.now();
  
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