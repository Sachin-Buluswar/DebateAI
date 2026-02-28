/**
 * Sentry client-side configuration for Eris Debate
 * Handles error tracking and performance monitoring in the browser
 */

import * as Sentry from '@sentry/nextjs';

const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;
const ENVIRONMENT = process.env.NODE_ENV || 'development';

if (SENTRY_DSN && (ENVIRONMENT === 'production' || process.env.NEXT_PUBLIC_ENABLE_SENTRY_DEV === 'true')) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: ENVIRONMENT,

    // Performance Monitoring
    tracesSampleRate: ENVIRONMENT === 'production' ? 0.1 : 1.0,

    // Release tracking
    release: process.env.npm_package_version || '0.1.0',

    // Replay configuration for debugging production issues
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: ENVIRONMENT === 'production' ? 1.0 : 0,

    integrations: [
      Sentry.replayIntegration({
        maskAllText: true,
        blockAllMedia: true,
      }),
      Sentry.browserTracingIntegration(),
    ],

    // Configure what to capture
    ignoreErrors: [
      // Browser extensions and noise
      'ResizeObserver loop limit exceeded',
      'ResizeObserver loop completed with undelivered notifications',
      // Network errors users can't control
      'Failed to fetch',
      'Load failed',
      'NetworkError',
      'AbortError',
      // Next.js navigation
      'NEXT_NOT_FOUND',
      'NEXT_REDIRECT',
      // Auth expected errors
      'Auth session missing',
    ],

    denyUrls: [
      // Browser extensions
      /extensions\//i,
      /^chrome:\/\//i,
      /^chrome-extension:\/\//i,
      /^moz-extension:\/\//i,
    ],

    // Before sending event to Sentry
    beforeSend(event) {
      // Sanitize sensitive data from URLs
      if (event.request?.url) {
        event.request.url = event.request.url.replace(
          /token=[^&]+/g,
          'token=***'
        );
      }

      return event;
    },

    // Filter out health check transactions
    beforeSendTransaction(transaction) {
      if (transaction.transaction?.includes('/health')) {
        return null;
      }
      return transaction;
    },
  });
}
