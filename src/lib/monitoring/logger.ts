/**
 * Production-ready logger with structured logging
 * Supports multiple log levels, context, and error tracking
 */

import { NextRequest } from 'next/server';

type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

interface LogContext {
  userId?: string;
  sessionId?: string;
  requestId?: string;
  service?: string;
  action?: string;
  metadata?: Record<string, any>;
}

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: LogContext;
  error?: {
    name: string;
    message: string;
    stack?: string;
    code?: string;
  };
  duration?: number;
}

class Logger {
  private serviceName: string;
  private logLevel: LogLevel;
  private isDevelopment: boolean;

  constructor(serviceName: string) {
    this.serviceName = serviceName;
    this.isDevelopment = process.env.NODE_ENV !== 'production';
    this.logLevel = (process.env.LOG_LEVEL as LogLevel) || 'info';
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error', 'fatal'];
    const currentLevelIndex = levels.indexOf(this.logLevel);
    const requestedLevelIndex = levels.indexOf(level);
    return requestedLevelIndex >= currentLevelIndex;
  }

  private formatLog(entry: LogEntry): string {
    if (this.isDevelopment) {
      // Human-readable format for development
      const levelColors = {
        debug: '\x1b[36m', // cyan
        info: '\x1b[32m',  // green
        warn: '\x1b[33m',  // yellow
        error: '\x1b[31m', // red
        fatal: '\x1b[35m'  // magenta
      };
      
      const color = levelColors[entry.level];
      const reset = '\x1b[0m';
      
      let output = `${color}[${entry.level.toUpperCase()}]${reset} ${entry.timestamp} [${this.serviceName}] ${entry.message}`;
      
      if (entry.context) {
        output += `\n  Context: ${JSON.stringify(entry.context, null, 2)}`;
      }
      
      if (entry.error) {
        output += `\n  Error: ${entry.error.name}: ${entry.error.message}`;
        if (entry.error.stack) {
          output += `\n  Stack: ${entry.error.stack}`;
        }
      }
      
      return output;
    } else {
      // JSON format for production (easier to parse by log aggregators)
      return JSON.stringify({
        ...entry,
        service: this.serviceName,
        environment: process.env.NODE_ENV
      });
    }
  }

  private log(level: LogLevel, message: string, context?: LogContext, error?: Error, duration?: number) {
    if (!this.shouldLog(level)) return;

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context,
      duration
    };

    if (error) {
      entry.error = {
        name: error.name,
        message: error.message,
        stack: error.stack,
        code: (error as any).code
      };
    }

    const formattedLog = this.formatLog(entry);
    
    switch (level) {
      case 'debug':
      case 'info':
        console.log(formattedLog);
        break;
      case 'warn':
        console.warn(formattedLog);
        break;
      case 'error':
      case 'fatal':
        console.error(formattedLog);
        break;
    }

    // In production, send critical errors to monitoring service
    if (!this.isDevelopment && (level === 'error' || level === 'fatal')) {
      this.sendToMonitoringService(entry);
    }
  }

  private async sendToMonitoringService(entry: LogEntry) {
    // Integration point for services like Sentry, DataDog, etc.
    // For now, we'll just log that we would send it
    if (process.env.MONITORING_ENDPOINT) {
      try {
        // Example: Send to monitoring service
        // await fetch(process.env.MONITORING_ENDPOINT, {
        //   method: 'POST',
        //   headers: { 'Content-Type': 'application/json' },
        //   body: JSON.stringify(entry)
        // });
      } catch (error) {
        // Don't throw if monitoring fails
        console.error('Failed to send log to monitoring service:', error);
      }
    }
  }

  debug(message: string, context?: LogContext) {
    this.log('debug', message, context);
  }

  info(message: string, context?: LogContext) {
    this.log('info', message, context);
  }

  warn(message: string, context?: LogContext) {
    this.log('warn', message, context);
  }

  error(message: string, error?: Error, context?: LogContext) {
    this.log('error', message, context, error);
  }

  fatal(message: string, error?: Error, context?: LogContext) {
    this.log('fatal', message, context, error);
  }

  // Helper method for timing operations
  time(label: string, context?: LogContext): () => void {
    const start = Date.now();
    return () => {
      const duration = Date.now() - start;
      this.info(`${label} completed`, { 
        ...context, 
        metadata: { 
          ...context?.metadata, 
          duration: `${duration}ms` 
        } 
      });
    };
  }

  // Helper method for API request logging
  logRequest(req: NextRequest, context?: LogContext) {
    const requestContext: LogContext = {
      ...context,
      requestId: crypto.randomUUID(),
      metadata: {
        method: req.method,
        url: req.url,
        userAgent: req.headers.get('user-agent'),
        ip: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip')
      }
    };

    this.info(`${req.method} ${new URL(req.url).pathname}`, requestContext);
    return requestContext;
  }

  // Create a child logger with additional context
  child(additionalContext: LogContext): Logger {
    const childLogger = new Logger(`${this.serviceName}:${additionalContext.service || 'child'}`);
    
    // Override log method to include parent context
    const originalLog = childLogger.log.bind(childLogger);
    childLogger.log = (level, message, context, error, duration) => {
      originalLog(level, message, { ...additionalContext, ...context }, error, duration);
    };
    
    return childLogger;
  }
}

// Create singleton instances for common services
export const apiLogger = new Logger('api');
export const dbLogger = new Logger('database');
export const authLogger = new Logger('auth');
export const aiLogger = new Logger('ai');
export const socketLogger = new Logger('socket');

// Export the Logger class for custom instances
export default Logger;