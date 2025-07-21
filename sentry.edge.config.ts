/**
 * Sentry edge runtime configuration for Atlas Debate
 * Handles error tracking in Edge functions and middleware
 */

import * as Sentry from '@sentry/nextjs';

const SENTRY_DSN = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;
const ENVIRONMENT = process.env.NODE_ENV || 'development';

if (SENTRY_DSN && (ENVIRONMENT === 'production' || process.env.ENABLE_SENTRY_DEV === 'true')) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: ENVIRONMENT,
    
    // Performance Monitoring
    tracesSampleRate: ENVIRONMENT === 'production' ? 0.1 : 1.0,
    
    // Release tracking
    release: process.env.npm_package_version || '0.1.0',
    
    // Edge runtime doesn't support all integrations
    integrations: [],
    
    // Configure what to capture
    ignoreErrors: [
      'NEXT_NOT_FOUND',
      'NEXT_REDIRECT',
    ],
    
    // Before sending event to Sentry
    beforeSend(event) {
      // Add edge runtime context
      event.contexts = {
        ...event.contexts,
        runtime: {
          name: 'Edge',
        },
      };
      
      return event;
    },
  });
}