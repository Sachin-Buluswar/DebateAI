/**
 * Performance monitoring utilities
 * Tracks API response times, database queries, and external service calls
 */

import Logger from './logger';

interface PerformanceMetric {
  name: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  metadata?: Record<string, any>;
  threshold?: number; // ms
}

interface PerformanceReport {
  timestamp: string;
  metrics: PerformanceMetric[];
  totalDuration: number;
  slowOperations: PerformanceMetric[];
}

export class PerformanceMonitor {
  private metrics: Map<string, PerformanceMetric> = new Map();
  private logger: Logger;
  private defaultThreshold: number = 1000; // 1 second

  constructor(serviceName: string) {
    this.logger = new Logger(`performance:${serviceName}`);
  }

  /**
   * Start timing an operation
   */
  startTimer(name: string, metadata?: Record<string, any>, threshold?: number): void {
    this.metrics.set(name, {
      name,
      startTime: performance.now(),
      metadata,
      threshold: threshold || this.defaultThreshold
    });
  }

  /**
   * End timing an operation
   */
  endTimer(name: string, additionalMetadata?: Record<string, any>): number | null {
    const metric = this.metrics.get(name);
    if (!metric) {
      this.logger.warn(`No timer found for: ${name}`);
      return null;
    }

    metric.endTime = performance.now();
    metric.duration = metric.endTime - metric.startTime;
    
    if (additionalMetadata) {
      metric.metadata = { ...metric.metadata, ...additionalMetadata };
    }

    // Log if operation exceeded threshold
    if (metric.duration > metric.threshold!) {
      this.logger.warn(`Slow operation detected: ${name}`, {
        metadata: {
          duration: `${metric.duration.toFixed(2)}ms`,
          threshold: `${metric.threshold}ms`,
          ...metric.metadata
        }
      });
    }

    return metric.duration;
  }

  /**
   * Time an async operation
   */
  async timeAsync<T>(
    name: string,
    operation: () => Promise<T>,
    metadata?: Record<string, any>,
    threshold?: number
  ): Promise<T> {
    this.startTimer(name, metadata, threshold);
    
    try {
      const result = await operation();
      this.endTimer(name, { status: 'success' });
      return result;
    } catch (error) {
      this.endTimer(name, { 
        status: 'error', 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      throw error;
    }
  }

  /**
   * Time a sync operation
   */
  timeSync<T>(
    name: string,
    operation: () => T,
    metadata?: Record<string, any>,
    threshold?: number
  ): T {
    this.startTimer(name, metadata, threshold);
    
    try {
      const result = operation();
      this.endTimer(name, { status: 'success' });
      return result;
    } catch (error) {
      this.endTimer(name, { 
        status: 'error', 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      throw error;
    }
  }

  /**
   * Generate a performance report
   */
  generateReport(): PerformanceReport {
    const completedMetrics = Array.from(this.metrics.values())
      .filter(m => m.duration !== undefined);
    
    const totalDuration = completedMetrics.reduce(
      (sum, m) => sum + (m.duration || 0), 
      0
    );
    
    const slowOperations = completedMetrics.filter(
      m => m.duration! > m.threshold!
    );

    const report: PerformanceReport = {
      timestamp: new Date().toISOString(),
      metrics: completedMetrics,
      totalDuration,
      slowOperations
    };

    // Log the report
    this.logger.info('Performance report generated', {
      metadata: {
        totalOperations: completedMetrics.length,
        totalDuration: `${totalDuration.toFixed(2)}ms`,
        slowOperations: slowOperations.length
      }
    });

    return report;
  }

  /**
   * Clear all metrics
   */
  clear(): void {
    this.metrics.clear();
  }

  /**
   * Create middleware for Express-like APIs
   */
  middleware() {
    return async (req: Request, handler: () => Promise<Response>): Promise<Response> => {
      const url = new URL(req.url);
      const timerName = `${req.method} ${url.pathname}`;
      
      this.startTimer(timerName, {
        method: req.method,
        path: url.pathname,
        query: url.search
      });

      try {
        const response = await handler();
        
        const duration = this.endTimer(timerName, {
          status: response.status,
          ok: response.ok
        });

        // Add performance header
        const headers = new Headers(response.headers);
        headers.set('X-Response-Time', `${duration?.toFixed(2)}ms`);
        
        return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers
        });
      } catch (error) {
        this.endTimer(timerName, {
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        throw error;
      }
    };
  }
}

// Utility class for tracking database performance
export class DatabasePerformanceTracker {
  private monitor: PerformanceMonitor;

  constructor() {
    this.monitor = new PerformanceMonitor('database');
  }

  async trackQuery<T>(
    queryName: string,
    query: () => Promise<T>,
    metadata?: Record<string, any>
  ): Promise<T> {
    return this.monitor.timeAsync(
      queryName,
      query,
      { type: 'query', ...metadata },
      500 // 500ms threshold for DB queries
    );
  }

  async trackTransaction<T>(
    transactionName: string,
    transaction: () => Promise<T>,
    metadata?: Record<string, any>
  ): Promise<T> {
    return this.monitor.timeAsync(
      transactionName,
      transaction,
      { type: 'transaction', ...metadata },
      2000 // 2s threshold for transactions
    );
  }

  generateReport(): PerformanceReport {
    return this.monitor.generateReport();
  }
}

// Utility class for tracking external API performance
export class ExternalAPIPerformanceTracker {
  private monitor: PerformanceMonitor;

  constructor(apiName: string) {
    this.monitor = new PerformanceMonitor(`external-api:${apiName}`);
  }

  async trackAPICall<T>(
    endpoint: string,
    apiCall: () => Promise<T>,
    metadata?: Record<string, any>
  ): Promise<T> {
    return this.monitor.timeAsync(
      endpoint,
      apiCall,
      metadata,
      3000 // 3s threshold for external APIs
    );
  }

  generateReport(): PerformanceReport {
    return this.monitor.generateReport();
  }
}

// Export singleton instances
export const apiPerformance = new PerformanceMonitor('api');
export const dbPerformance = new DatabasePerformanceTracker();
export const openaiPerformance = new ExternalAPIPerformanceTracker('openai');
export const elevenLabsPerformance = new ExternalAPIPerformanceTracker('elevenlabs');