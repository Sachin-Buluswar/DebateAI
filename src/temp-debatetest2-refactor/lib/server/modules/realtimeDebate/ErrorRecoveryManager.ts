import { Socket } from 'socket.io';

export interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
}

export interface ErrorMetrics {
  totalErrors: number;
  apiErrors: number;
  networkErrors: number;
  ttsErrors: number;
  sttErrors: number;
  lastErrorTime: number | null;
}

/**
 * Manages error recovery for the debate system with exponential backoff,
 * fallback mechanisms, and comprehensive error tracking
 */
export class ErrorRecoveryManager {
  private retryConfig: RetryConfig;
  private errorMetrics: Map<string, ErrorMetrics> = new Map();
  private circuitBreakerStates: Map<string, { isOpen: boolean; lastFailure: number; failures: number }> = new Map();

  constructor(retryConfig?: Partial<RetryConfig>) {
    this.retryConfig = {
      maxRetries: 3,
      baseDelayMs: 1000,
      maxDelayMs: 30000,
      backoffMultiplier: 2,
      ...retryConfig
    };
  }

  /**
   * Execute an operation with retry logic and error recovery
   */
  async executeWithRetry<T>(
    sessionId: string,
    operation: () => Promise<T>,
    operationType: string,
    socket?: Socket
  ): Promise<T | null> {
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt <= this.retryConfig.maxRetries; attempt++) {
      try {
        // Check circuit breaker
        if (this.isCircuitBreakerOpen(operationType)) {
          throw new Error(`Circuit breaker is open for ${operationType}`);
        }

        const result = await operation();
        
        // Reset circuit breaker on success
        this.resetCircuitBreaker(operationType);
        
        // Log recovery if this was a retry
        if (attempt > 0) {
          console.log(`✅ Recovery successful for ${operationType} after ${attempt} retries`);
          socket?.emit('errorRecovered', { 
            type: operationType, 
            attempt,
            message: `${operationType} recovered successfully` 
          });
        }
        
        return result;
      } catch (error) {
        lastError = error as Error;
        
        // Track error metrics
        this.trackError(sessionId, operationType, lastError);
        
        // Update circuit breaker
        this.updateCircuitBreaker(operationType);
        
        // Don't retry on the last attempt
        if (attempt === this.retryConfig.maxRetries) {
          break;
        }
        
        // Calculate delay with exponential backoff
        const delay = Math.min(
          this.retryConfig.baseDelayMs * Math.pow(this.retryConfig.backoffMultiplier, attempt),
          this.retryConfig.maxDelayMs
        );
        
        console.warn(`⚠️ ${operationType} failed (attempt ${attempt + 1}/${this.retryConfig.maxRetries + 1}): ${lastError.message}. Retrying in ${delay}ms...`);
        
        // Emit error event to client
        socket?.emit('errorRetrying', {
          type: operationType,
          attempt: attempt + 1,
          maxRetries: this.retryConfig.maxRetries + 1,
          delayMs: delay,
          error: lastError.message
        });
        
        // Wait before retrying
        await this.delay(delay);
      }
    }
    
    // All retries failed
    console.error(`❌ ${operationType} failed permanently after ${this.retryConfig.maxRetries + 1} attempts:`, lastError?.message);
    
    socket?.emit('errorPermanent', {
      type: operationType,
      error: lastError?.message || 'Unknown error',
      fallbackAvailable: this.hasFallback(operationType)
    });
    
    // Try fallback if available
    return this.tryFallback(sessionId, operationType, socket);
  }

  /**
   * Handle TTS errors with fallback to text display
   */
  async handleTTSError(
    sessionId: string,
    text: string,
    speaker: string,
    socket: Socket,
    originalError: Error
  ): Promise<void> {
    console.warn(`TTS failed for ${speaker}, falling back to text display:`, originalError.message);
    
    // Emit text-only speech as fallback
    socket.emit('aiSpeech', { 
      speaker, 
      text, 
      fallbackMode: true,
      originalError: 'Audio generation failed - displaying text only'
    });
    
    this.trackError(sessionId, 'tts', originalError);
  }

  /**
   * Handle STT errors with fallback to manual input
   */
  async handleSTTError(
    sessionId: string,
    socket: Socket,
    originalError: Error
  ): Promise<void> {
    console.warn(`STT failed, providing manual input option:`, originalError.message);
    
    socket.emit('sttFallback', {
      message: 'Speech recognition unavailable. Please use text input.',
      showTextInput: true,
      error: originalError.message
    });
    
    this.trackError(sessionId, 'stt', originalError);
  }

  /**
   * Handle debate state synchronization errors
   */
  async handleStateError(
    sessionId: string,
    socket: Socket,
    originalError: Error
  ): Promise<void> {
    console.warn(`Debate state error:`, originalError.message);
    
    socket.emit('stateError', {
      message: 'Debate synchronization issue. Attempting to recover...',
      canContinue: true,
      error: originalError.message
    });
    
    this.trackError(sessionId, 'state', originalError);
  }

  /**
   * Handle crossfire session errors
   */
  async handleCrossfireError(
    sessionId: string,
    socket: Socket,
    originalError: Error
  ): Promise<void> {
    console.warn(`Crossfire session error:`, originalError.message);
    
    socket.emit('crossfireError', {
      message: 'Real-time crossfire unavailable. Switching to turn-based mode.',
      fallbackMode: 'turn-based',
      error: originalError.message
    });
    
    this.trackError(sessionId, 'crossfire', originalError);
  }

  /**
   * Get error metrics for a session
   */
  getErrorMetrics(sessionId: string): ErrorMetrics {
    return this.errorMetrics.get(sessionId) || {
      totalErrors: 0,
      apiErrors: 0,
      networkErrors: 0,
      ttsErrors: 0,
      sttErrors: 0,
      lastErrorTime: null
    };
  }

  /**
   * Check if system health is degraded
   */
  isSystemHealthy(sessionId: string): boolean {
    const metrics = this.getErrorMetrics(sessionId);
    const recentErrorThreshold = 5 * 60 * 1000; // 5 minutes
    const now = Date.now();
    
    // Check if there are recent errors
    if (metrics.lastErrorTime && (now - metrics.lastErrorTime) < recentErrorThreshold) {
      if (metrics.totalErrors > 10) {
        return false;
      }
    }
    
    return true;
  }

  /**
   * Clean up error tracking for a session
   */
  cleanupSession(sessionId: string): void {
    this.errorMetrics.delete(sessionId);
  }

  /**
   * Track error occurrence and update metrics
   */
  private trackError(sessionId: string, operationType: string, error: Error): void {
    const metrics = this.errorMetrics.get(sessionId) || {
      totalErrors: 0,
      apiErrors: 0,
      networkErrors: 0,
      ttsErrors: 0,
      sttErrors: 0,
      lastErrorTime: null
    };

    metrics.totalErrors++;
    metrics.lastErrorTime = Date.now();

    // Categorize error type
    if (operationType === 'tts') {
      metrics.ttsErrors++;
    } else if (operationType === 'stt') {
      metrics.sttErrors++;
    } else if (error.message.includes('network') || error.message.includes('fetch')) {
      metrics.networkErrors++;
    } else {
      metrics.apiErrors++;
    }

    this.errorMetrics.set(sessionId, metrics);
  }

  /**
   * Check if circuit breaker is open for an operation type
   */
  private isCircuitBreakerOpen(operationType: string): boolean {
    const state = this.circuitBreakerStates.get(operationType);
    if (!state || !state.isOpen) {
      return false;
    }

    // Auto-reset circuit breaker after 60 seconds
    const resetTime = 60 * 1000;
    if (Date.now() - state.lastFailure > resetTime) {
      this.resetCircuitBreaker(operationType);
      return false;
    }

    return true;
  }

  /**
   * Update circuit breaker state on failure
   */
  private updateCircuitBreaker(operationType: string): void {
    const state = this.circuitBreakerStates.get(operationType) || {
      isOpen: false,
      lastFailure: 0,
      failures: 0
    };

    state.failures++;
    state.lastFailure = Date.now();

    // Open circuit breaker after 5 consecutive failures
    if (state.failures >= 5) {
      state.isOpen = true;
      console.warn(`🚫 Circuit breaker opened for ${operationType} due to repeated failures`);
    }

    this.circuitBreakerStates.set(operationType, state);
  }

  /**
   * Reset circuit breaker on successful operation
   */
  private resetCircuitBreaker(operationType: string): void {
    const state = this.circuitBreakerStates.get(operationType);
    if (state) {
      state.isOpen = false;
      state.failures = 0;
      this.circuitBreakerStates.set(operationType, state);
    }
  }

  /**
   * Check if fallback is available for operation type
   */
  private hasFallback(operationType: string): boolean {
    const fallbacks = ['tts', 'stt', 'crossfire'];
    return fallbacks.includes(operationType);
  }

  /**
   * Try fallback mechanism for failed operation
   */
  private async tryFallback(sessionId: string, operationType: string, socket?: Socket): Promise<null> {
    if (!socket) return null;

    switch (operationType) {
      case 'tts':
        socket.emit('fallbackToText', { 
          message: 'Audio generation unavailable. Speeches will be displayed as text.' 
        });
        break;
      case 'stt':
        socket.emit('fallbackToTextInput', { 
          message: 'Speech recognition unavailable. Please use text input to participate.' 
        });
        break;
      case 'crossfire':
        socket.emit('fallbackToTurnBased', { 
          message: 'Real-time crossfire unavailable. Using turn-based debate format.' 
        });
        break;
    }

    return null;
  }

  /**
   * Utility method for delays
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
} 