'use client';

import { useEffect, useRef, useCallback } from 'react';
import { sentryClient } from '../../sentry.client.config';
import { debateMetrics } from '@/lib/monitoring/opentelemetry';

interface PerformanceEntry {
  name: string;
  startTime: number;
  duration: number;
  metadata?: Record<string, any>;
}

interface UsePerformanceMonitorOptions {
  componentName: string;
  reportThreshold?: number; // ms
  enableWebVitals?: boolean;
  trackRenderTime?: boolean;
}

export function usePerformanceMonitor({
  componentName,
  reportThreshold = 1000,
  enableWebVitals = true,
  trackRenderTime = true,
}: UsePerformanceMonitorOptions) {
  const renderStartTime = useRef<number>(performance.now());
  const entries = useRef<Map<string, PerformanceEntry>>(new Map());
  const hasReportedMount = useRef(false);

  // Track component mount time
  useEffect(() => {
    if (trackRenderTime && !hasReportedMount.current) {
      const mountTime = performance.now() - renderStartTime.current;
      
      if (mountTime > reportThreshold) {
        sentryClient.captureMessage(
          `Slow component mount: ${componentName}`,
          'warning'
        );
        sentryClient.addBreadcrumb({
          category: 'performance',
          message: `${componentName} mounted`,
          level: 'warning',
          data: {
            duration: mountTime,
            threshold: reportThreshold,
          },
        });
      }

      // Log to console in development
      if (process.env.NODE_ENV === 'development') {
        console.log(`[Performance] ${componentName} mounted in ${mountTime.toFixed(2)}ms`);
      }

      hasReportedMount.current = true;
    }
  }, [componentName, reportThreshold, trackRenderTime]);

  // Monitor Web Vitals
  useEffect(() => {
    if (!enableWebVitals || typeof window === 'undefined') return;

    const reportWebVital = (metric: any) => {
      sentryClient.addBreadcrumb({
        category: 'web-vital',
        message: metric.name,
        level: 'info',
        data: {
          value: metric.value,
          rating: metric.rating,
          componentName,
        },
      });

      // Report poor metrics
      if (metric.rating === 'poor') {
        sentryClient.captureMessage(
          `Poor ${metric.name}: ${metric.value}`,
          'warning'
        );
      }
    };

    // Observe LCP, FID, CLS
    if ('PerformanceObserver' in window) {
      try {
        const lcpObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const lastEntry = entries[entries.length - 1] as any;
          reportWebVital({
            name: 'LCP',
            value: lastEntry.startTime,
            rating: lastEntry.startTime > 2500 ? 'poor' : lastEntry.startTime > 1000 ? 'needs-improvement' : 'good',
          });
        });
        lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });

        return () => {
          lcpObserver.disconnect();
        };
      } catch (e) {
        // Silently fail if observer is not supported
      }
    }
  }, [componentName, enableWebVitals]);

  // Start timing an operation
  const startTimer = useCallback((name: string, metadata?: Record<string, any>) => {
    entries.current.set(name, {
      name,
      startTime: performance.now(),
      duration: 0,
      metadata,
    });
  }, []);

  // End timing an operation
  const endTimer = useCallback((name: string, additionalMetadata?: Record<string, any>) => {
    const entry = entries.current.get(name);
    if (!entry) {
      console.warn(`[Performance] No timer found for: ${name}`);
      return null;
    }

    entry.duration = performance.now() - entry.startTime;
    entry.metadata = { ...entry.metadata, ...additionalMetadata };

    // Report slow operations
    if (entry.duration > reportThreshold) {
      sentryClient.addBreadcrumb({
        category: 'performance',
        message: `Slow operation: ${name}`,
        level: 'warning',
        data: {
          component: componentName,
          duration: entry.duration,
          ...entry.metadata,
        },
      });

      if (process.env.NODE_ENV === 'development') {
        console.warn(`[Performance] Slow operation in ${componentName}: ${name} took ${entry.duration.toFixed(2)}ms`);
      }
    }

    entries.current.delete(name);
    return entry.duration;
  }, [componentName, reportThreshold]);

  // Time an async operation
  const timeAsync = useCallback(async <T,>(
    name: string,
    operation: () => Promise<T>,
    metadata?: Record<string, any>
  ): Promise<T> => {
    startTimer(name, metadata);
    
    try {
      const result = await operation();
      endTimer(name, { status: 'success' });
      return result;
    } catch (error) {
      endTimer(name, { 
        status: 'error', 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      throw error;
    }
  }, [startTimer, endTimer]);

  // Time a sync operation
  const timeSync = useCallback(<T,>(
    name: string,
    operation: () => T,
    metadata?: Record<string, any>
  ): T => {
    startTimer(name, metadata);
    
    try {
      const result = operation();
      endTimer(name, { status: 'success' });
      return result;
    } catch (error) {
      endTimer(name, { 
        status: 'error', 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      throw error;
    }
  }, [startTimer, endTimer]);

  // Mark a specific point in time
  const mark = useCallback((name: string, metadata?: Record<string, any>) => {
    performance.mark(`${componentName}:${name}`);
    
    sentryClient.addBreadcrumb({
      category: 'performance',
      message: `Mark: ${name}`,
      level: 'info',
      data: {
        component: componentName,
        ...metadata,
      },
    });
  }, [componentName]);

  // Measure between two marks
  const measure = useCallback((name: string, startMark: string, endMark: string) => {
    try {
      performance.measure(
        `${componentName}:${name}`,
        `${componentName}:${startMark}`,
        `${componentName}:${endMark}`
      );
      
      const measures = performance.getEntriesByName(`${componentName}:${name}`, 'measure');
      const lastMeasure = measures[measures.length - 1];
      
      if (lastMeasure && lastMeasure.duration > reportThreshold) {
        sentryClient.addBreadcrumb({
          category: 'performance',
          message: `Slow measure: ${name}`,
          level: 'warning',
          data: {
            component: componentName,
            duration: lastMeasure.duration,
            startMark,
            endMark,
          },
        });
      }
      
      return lastMeasure?.duration;
    } catch (e) {
      console.error(`[Performance] Failed to measure ${name}:`, e);
      return null;
    }
  }, [componentName, reportThreshold]);

  return {
    startTimer,
    endTimer,
    timeAsync,
    timeSync,
    mark,
    measure,
  };
}

// Hook for monitoring API calls
export function useAPIPerformance() {
  const performanceMonitor = usePerformanceMonitor({
    componentName: 'API',
    reportThreshold: 2000,
  });

  const trackAPICall = useCallback(async <T,>(
    endpoint: string,
    request: () => Promise<T>,
    metadata?: Record<string, any>
  ): Promise<T> => {
    return performanceMonitor.timeAsync(
      `API:${endpoint}`,
      request,
      metadata
    );
  }, [performanceMonitor]);

  return { trackAPICall };
}

// Hook for Real User Monitoring (RUM)
export function useRUM(pageName: string) {
  useEffect(() => {
    // Track page view
    sentryClient.addBreadcrumb({
      category: 'navigation',
      message: `Page view: ${pageName}`,
      level: 'info',
      data: {
        url: window.location.href,
        referrer: document.referrer,
      },
    });

    // Track page visibility changes
    const handleVisibilityChange = () => {
      sentryClient.addBreadcrumb({
        category: 'navigation',
        message: `Page visibility: ${document.visibilityState}`,
        level: 'info',
        data: {
          page: pageName,
          hidden: document.hidden,
        },
      });
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Track page unload
    const handleBeforeUnload = () => {
      const navigationTiming = performance.getEntriesByType('navigation')[0] as any;
      if (navigationTiming) {
        sentryClient.addBreadcrumb({
          category: 'navigation',
          message: 'Page unload',
          level: 'info',
          data: {
            page: pageName,
            loadTime: navigationTiming.loadEventEnd - navigationTiming.fetchStart,
            domContentLoaded: navigationTiming.domContentLoadedEventEnd - navigationTiming.fetchStart,
          },
        });
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [pageName]);
}