/**
 * Sentry client-side configuration for Eris Debate
 * Handles error tracking and performance monitoring on the client
 */

import * as Sentry from '@sentry/nextjs';

const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;
const ENVIRONMENT = process.env.NEXT_PUBLIC_APP_ENV || 'development';

// Only initialize Sentry in production or if explicitly enabled
if (SENTRY_DSN && (ENVIRONMENT === 'production' || process.env.NEXT_PUBLIC_ENABLE_SENTRY_DEV === 'true')) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: ENVIRONMENT,
    
    // Performance Monitoring
    tracesSampleRate: ENVIRONMENT === 'production' ? 0.1 : 1.0, // 10% in production, 100% in dev
    
    // Session Replay
    replaysSessionSampleRate: 0.1, // 10% of sessions will be recorded
    replaysOnErrorSampleRate: 1.0, // 100% of sessions with errors
    
    // Release tracking
    release: process.env.NEXT_PUBLIC_APP_VERSION || '0.1.0',
    
    // Integrations
    integrations: [
      // Browser tracing
      Sentry.browserTracingIntegration(),
      
      // Replay integration
      Sentry.replayIntegration({
        maskAllText: false,
        blockAllMedia: false,
      }),
      
      // Custom integration for debate events
      {
        name: 'Eris Debate',
        setupOnce() {
          // Track debate-specific events
          if (typeof window !== 'undefined') {
            window.addEventListener('debate:start', (event: any) => {
              Sentry.addBreadcrumb({
                category: 'debate',
                message: 'Debate started',
                level: 'info',
                data: event.detail,
              });
            });
            
            window.addEventListener('debate:error', (event: any) => {
              Sentry.captureException(new Error(event.detail.message), {
                tags: {
                  component: 'debate',
                },
                extra: event.detail,
              });
            });
          }
        },
      },
    ],
    
    // Configure what to capture
    ignoreErrors: [
      // Browser extensions
      'top.GLOBALS',
      // Random browser errors
      'ResizeObserver loop limit exceeded',
      'Non-Error promise rejection captured',
      // Network errors that are expected
      /NetworkError/,
      /Failed to fetch/,
    ],
    
    // Before sending event to Sentry
    beforeSend(event, hint) {
      // Filter out non-critical errors in development
      if (ENVIRONMENT === 'development') {
        const error = hint.originalException;
        if (error && error instanceof Error) {
          if (error.message?.includes('hydration')) {
            return null; // Don't send hydration errors in dev
          }
        }
      }
      
      // Add user context if available
      if (typeof window !== 'undefined') {
        const userString = window.localStorage.getItem('user');
        if (userString) {
          try {
            const user = JSON.parse(userString);
            event.user = {
              id: user.id,
              email: user.email,
            };
          } catch (e) {
            // Ignore parse errors
          }
        }
      }
      
      return event;
    },
  });
  
  // Set initial user context if available
  if (typeof window !== 'undefined') {
    const userString = window.localStorage.getItem('user');
    if (userString) {
      try {
        const user = JSON.parse(userString);
        Sentry.setUser({
          id: user.id,
          email: user.email,
        });
      } catch (e) {
        // Ignore parse errors
      }
    }
  }
}

// Export the required hook for Sentry navigation instrumentation
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;

// Export utilities for manual error tracking
export const sentryClient = {
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
  
  setUser: (user: Sentry.User | null) => {
    if (SENTRY_DSN) {
      Sentry.setUser(user);
    }
  },
  
  startTransaction: (context: any) => {
    if (SENTRY_DSN) {
      return Sentry.startInactiveSpan(context);
    }
    return null;
  },
};