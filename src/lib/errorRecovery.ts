/**
 * Comprehensive error recovery utilities for production-ready error handling
 */

interface RetryOptions {
  maxRetries?: number;
  initialDelay?: number;
  maxDelay?: number;
  backoffMultiplier?: number;
  onRetry?: (error: Error, attempt: number) => void;
  shouldRetry?: (error: Error) => boolean;
}

const DEFAULT_RETRY_OPTIONS: Required<Omit<RetryOptions, 'onRetry' | 'shouldRetry'>> = {
  maxRetries: 3,
  initialDelay: 1000,
  maxDelay: 10000,
  backoffMultiplier: 2,
};

/**
 * Default function to determine if an error is retryable
 */
function isRetryableError(error: Error): boolean {
  // Network errors
  if (error.message.includes('fetch failed') || 
      error.message.includes('ECONNREFUSED') ||
      error.message.includes('ETIMEDOUT')) {
    return true;
  }

  // HTTP status codes that are retryable
  if ('status' in error) {
    const status = (error as any).status;
    return status === 429 || // Rate limited
           status === 503 || // Service unavailable
           status === 504 || // Gateway timeout
           status >= 500;    // Server errors
  }

  return false;
}

/**
 * Execute a function with exponential backoff retry logic
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_RETRY_OPTIONS, ...options };
  const shouldRetry = opts.shouldRetry || isRetryableError;

  let lastError: Error;
  
  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      
      if (attempt === opts.maxRetries || !shouldRetry(lastError)) {
        throw lastError;
      }

      if (opts.onRetry) {
        opts.onRetry(lastError, attempt + 1);
      }

      const delay = Math.min(
        opts.initialDelay * Math.pow(opts.backoffMultiplier, attempt),
        opts.maxDelay
      );

      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError!;
}

/**
 * Circuit breaker implementation for preventing cascading failures
 */
export class CircuitBreaker {
  private failures = 0;
  private lastFailureTime = 0;
  private state: 'closed' | 'open' | 'half-open' = 'closed';

  constructor(
    private readonly threshold: number = 5,
    private readonly timeout: number = 60000, // 1 minute
    private readonly resetTimeout: number = 30000 // 30 seconds
  ) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailureTime > this.timeout) {
        this.state = 'half-open';
      } else {
        throw new Error('Circuit breaker is open');
      }
    }

    try {
      const result = await fn();
      if (this.state === 'half-open') {
        this.reset();
      }
      return result;
    } catch (error) {
      this.recordFailure();
      throw error;
    }
  }

  private recordFailure() {
    this.failures++;
    this.lastFailureTime = Date.now();
    
    if (this.failures >= this.threshold) {
      this.state = 'open';
    }
  }

  private reset() {
    this.failures = 0;
    this.state = 'closed';
    this.lastFailureTime = 0;
  }
}

/**
 * Fallback handler for graceful degradation
 */
export class FallbackHandler<T> {
  constructor(
    private readonly fallbacks: Array<() => Promise<T> | T>
  ) {}

  async execute(primaryFn: () => Promise<T>): Promise<T> {
    try {
      return await primaryFn();
    } catch (primaryError) {
      console.error('Primary function failed:', primaryError);
      
      for (let i = 0; i < this.fallbacks.length; i++) {
        try {
          return await this.fallbacks[i]();
        } catch (fallbackError) {
          console.error(`Fallback ${i + 1} failed:`, fallbackError);
        }
      }
      
      throw new Error('All fallbacks failed');
    }
  }
}

/**
 * Queue for managing failed operations that should be retried later
 */
export class RetryQueue<T> {
  private queue: Array<{
    fn: () => Promise<T>;
    resolve: (value: T) => void;
    reject: (error: Error) => void;
    attempts: number;
  }> = [];
  
  private processing = false;

  constructor(
    private readonly maxQueueSize: number = 100,
    private readonly processInterval: number = 5000
  ) {
    this.startProcessing();
  }

  async add(fn: () => Promise<T>): Promise<T> {
    if (this.queue.length >= this.maxQueueSize) {
      throw new Error('Retry queue is full');
    }

    return new Promise((resolve, reject) => {
      this.queue.push({ fn, resolve, reject, attempts: 0 });
    });
  }

  private async startProcessing() {
    if (this.processing) return;
    
    this.processing = true;
    
    while (this.processing) {
      await this.processQueue();
      await new Promise(resolve => setTimeout(resolve, this.processInterval));
    }
  }

  private async processQueue() {
    const items = [...this.queue];
    this.queue = [];

    for (const item of items) {
      try {
        const result = await item.fn();
        item.resolve(result);
      } catch (error) {
        item.attempts++;
        
        if (item.attempts < 3) {
          this.queue.push(item);
        } else {
          item.reject(error as Error);
        }
      }
    }
  }

  stop() {
    this.processing = false;
  }
}

/**
 * Error recovery manager for coordinating different recovery strategies
 */
export class ErrorRecoveryManager {
  private circuitBreakers = new Map<string, CircuitBreaker>();
  private retryQueues = new Map<string, RetryQueue<any>>();

  getCircuitBreaker(key: string): CircuitBreaker {
    if (!this.circuitBreakers.has(key)) {
      this.circuitBreakers.set(key, new CircuitBreaker());
    }
    return this.circuitBreakers.get(key)!;
  }

  getRetryQueue<T>(key: string): RetryQueue<T> {
    if (!this.retryQueues.has(key)) {
      this.retryQueues.set(key, new RetryQueue<T>());
    }
    return this.retryQueues.get(key)!;
  }

  async executeWithRecovery<T>(
    key: string,
    fn: () => Promise<T>,
    options: {
      useCircuitBreaker?: boolean;
      useRetryQueue?: boolean;
      fallbacks?: Array<() => Promise<T> | T>;
      retryOptions?: RetryOptions;
    } = {}
  ): Promise<T> {
    const { useCircuitBreaker = true, useRetryQueue = true, fallbacks = [], retryOptions } = options;

    // Wrap with retry logic
    const retriableFn = () => withRetry(fn, retryOptions);

    // Wrap with circuit breaker if enabled
    const protectedFn = useCircuitBreaker
      ? () => this.getCircuitBreaker(key).execute(retriableFn)
      : retriableFn;

    // Execute with fallbacks if provided
    if (fallbacks.length > 0) {
      const fallbackHandler = new FallbackHandler(fallbacks);
      return fallbackHandler.execute(protectedFn);
    }

    try {
      return await protectedFn();
    } catch (error) {
      // Add to retry queue if enabled and circuit breaker is not open
      if (useRetryQueue && error instanceof Error && !error.message.includes('Circuit breaker is open')) {
        return this.getRetryQueue<T>(key).add(fn);
      }
      throw error;
    }
  }

  cleanup() {
    this.retryQueues.forEach(queue => queue.stop());
    this.circuitBreakers.clear();
    this.retryQueues.clear();
  }
}

// Global instance for convenience
export const globalErrorRecovery = new ErrorRecoveryManager();