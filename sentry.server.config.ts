/**
 * Sentry server-side configuration for Eris Debate
 * Handles error tracking and performance monitoring on the server
 */

import * as Sentry from '@sentry/nextjs';

const SENTRY_DSN = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;
const ENVIRONMENT = process.env.NODE_ENV || 'development';

// Only initialize Sentry in production or if explicitly enabled
if (SENTRY_DSN && (ENVIRONMENT === 'production' || process.env.ENABLE_SENTRY_DEV === 'true')) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: ENVIRONMENT,
    
    // Performance Monitoring
    tracesSampleRate: ENVIRONMENT === 'production' ? 0.1 : 1.0,
    
    // Profile sample rate (requires tracing)
    profilesSampleRate: 0.1,
    
    // Release tracking
    release: process.env.npm_package_version || '0.1.0',
    
    // Server name
    serverName: process.env.HOSTNAME || 'eris-debate-server',
    
    // Integrations
    integrations: [
      // HTTP integration
      Sentry.httpIntegration({
        breadcrumbs: true,
      }),
      
      // Custom integration for AI services
      {
        name: 'AIServices',
        setupOnce() {
          // Hook into AI service calls
          const originalFetch = global.fetch;
          global.fetch = async function(...args) {
            const [url, options] = args;
            const urlString = typeof url === 'string' ? url : url.toString();
            
            // Track OpenAI calls
            if (urlString.includes('api.openai.com')) {
              Sentry.addBreadcrumb({
                category: 'ai',
                message: 'OpenAI API call',
                level: 'info',
                data: {
                  url: urlString,
                  method: options?.method || 'GET',
                },
              });
            }
            
            // Track ElevenLabs calls
            if (urlString.includes('api.elevenlabs.io')) {
              Sentry.addBreadcrumb({
                category: 'ai',
                message: 'ElevenLabs API call',
                level: 'info',
                data: {
                  url: urlString,
                  method: options?.method || 'GET',
                },
              });
            }
            
            return originalFetch.apply(this, args);
          };
        },
      },
    ],
    
    // Configure what to capture
    ignoreErrors: [
      // Expected errors
      'NEXT_NOT_FOUND',
      'NEXT_REDIRECT',
      // Rate limiting
      'Too many requests',
    ],
    
    // Before sending event to Sentry
    beforeSend(event, hint) {
      // Sanitize sensitive data
      if (event.request) {
        // Remove auth headers
        if (event.request.headers) {
          delete event.request.headers.authorization;
          delete event.request.headers.cookie;
          delete event.request.headers['x-api-key'];
        }
        
        // Remove sensitive query params
        if (event.request.query_string && typeof event.request.query_string === 'string') {
          event.request.query_string = event.request.query_string.replace(
            /token=[^&]+/g,
            'token=***'
          );
        }
      }
      
      // Add additional context
      event.contexts = {
        ...event.contexts,
        runtime: {
          name: 'Node.js',
          version: process.version,
        },
        app: {
          app_memory: process.memoryUsage().heapUsed,
          app_start_time: new Date(Date.now() - process.uptime() * 1000).toISOString(),
        },
      };
      
      return event;
    },
    
    // Error filtering
    beforeSendTransaction(transaction) {
      // Don't send transactions for health checks
      if (transaction.transaction?.includes('/health')) {
        return null;
      }
      
      return transaction;
    },
  });
}

// Export utilities for manual error tracking
export const sentryServer = {
  captureException: (error: Error, context?: any) => {
    if (SENTRY_DSN) {
      Sentry.captureException(error, context);
    }
  },
  
  captureMessage: (message: string, level: Sentry.SeverityLevel = 'info') => {
    if (SENTRY_DSN) {
      Sentry.captureMessage(message, level);
    }
  },
  
  addBreadcrumb: (breadcrumb: Sentry.Breadcrumb) => {
    if (SENTRY_DSN) {
      Sentry.addBreadcrumb(breadcrumb);
    }
  },
  
  setContext: (key: string, context: any) => {
    if (SENTRY_DSN) {
      Sentry.setContext(key, context);
    }
  },
  
  withScope: (callback: (scope: Sentry.Scope) => void) => {
    if (SENTRY_DSN) {
      Sentry.withScope(callback);
    }
  },
  
  startTransaction: (context: any) => {
    if (SENTRY_DSN) {
      return Sentry.startInactiveSpan(context);
    }
    return null;
  },
  
  // Utility for wrapping async handlers
  wrapHandler: <T extends (...args: any[]) => Promise<any>>(
    handler: T,
    options?: { name?: string; op?: string }
  ): T => {
    return (async (...args: Parameters<T>) => {
      const transaction = sentryServer.startTransaction({
        name: options?.name || handler.name || 'anonymous',
        op: options?.op || 'function',
      });
      
      try {
        const result = await handler(...args);
        transaction?.end();
        return result;
      } catch (error) {
        sentryServer.captureException(error as Error);
        transaction?.end();
        throw error;
      }
    }) as T;
  },
};