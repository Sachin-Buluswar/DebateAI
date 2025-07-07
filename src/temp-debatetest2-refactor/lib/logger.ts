/**
 * Centralized Logging System for DebateAI
 * Production-ready structured logging with multiple transport options
 */

export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
}

export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  service: string;
  metadata?: Record<string, any>;
  userId?: string;
  requestId?: string;
  stack?: string;
}

export interface LogTransport {
  log(entry: LogEntry): Promise<void>;
}

// Console Transport (for development)
class ConsoleTransport implements LogTransport {
  async log(entry: LogEntry): Promise<void> {
    const levelNames = ['ERROR', 'WARN', 'INFO', 'DEBUG'];
    const levelName = levelNames[entry.level];
    const timestamp = new Date(entry.timestamp).toISOString();
    
    const baseMessage = `[${timestamp}] ${levelName} [${entry.service}]: ${entry.message}`;
    
    if (entry.metadata && Object.keys(entry.metadata).length > 0) {
      console.log(baseMessage, entry.metadata);
    } else {
      console.log(baseMessage);
    }
    
    if (entry.stack && entry.level === LogLevel.ERROR) {
      console.error(entry.stack);
    }
  }
}

// File Transport (for production)
class FileTransport implements LogTransport {
  private logDirectory: string;

  constructor(logDirectory: string = '/tmp/debateai-logs') {
    this.logDirectory = logDirectory;
  }

  async log(entry: LogEntry): Promise<void> {
    if (typeof window !== 'undefined') {
      // Skip file logging in browser environment
      return;
    }

    try {
      const fs = await import('fs/promises');
      const path = await import('path');
      
      // Ensure log directory exists
      try {
        await fs.mkdir(this.logDirectory, { recursive: true });
      } catch (error) {
        // Directory might already exist
      }

      const logLine = JSON.stringify(entry) + '\n';
      const date = new Date().toISOString().split('T')[0];
      const logFile = path.join(this.logDirectory, `debateai-${date}.log`);
      
      await fs.appendFile(logFile, logLine);
    } catch (error) {
      // Fallback to console if file logging fails
      console.error('Failed to write to log file:', error);
      const consoleTransport = new ConsoleTransport();
      await consoleTransport.log(entry);
    }
  }
}

// HTTP Transport (for external logging services like Datadog, LogDNA, etc.)
class HttpTransport implements LogTransport {
  private endpoint: string;
  private apiKey?: string;

  constructor(endpoint: string, apiKey?: string) {
    this.endpoint = endpoint;
    this.apiKey = apiKey;
  }

  async log(entry: LogEntry): Promise<void> {
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      
      if (this.apiKey) {
        headers['Authorization'] = `Bearer ${this.apiKey}`;
      }

      await fetch(this.endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(entry),
      });
    } catch (error) {
      // Fallback to console if HTTP logging fails
      console.error('Failed to send log to HTTP endpoint:', error);
      const consoleTransport = new ConsoleTransport();
      await consoleTransport.log(entry);
    }
  }
}

export class Logger {
  private transports: LogTransport[] = [];
  private service: string;
  private logLevel: LogLevel;

  constructor(service: string, logLevel: LogLevel = LogLevel.INFO) {
    this.service = service;
    this.logLevel = logLevel;
    
    // Default transports based on environment
    if (process.env.NODE_ENV === 'production') {
      this.transports.push(new FileTransport());
      
      // Add HTTP transport if configured
      if (process.env.LOG_HTTP_ENDPOINT) {
        this.transports.push(
          new HttpTransport(process.env.LOG_HTTP_ENDPOINT, process.env.LOG_API_KEY)
        );
      }
    } else {
      this.transports.push(new ConsoleTransport());
    }
  }

  addTransport(transport: LogTransport): void {
    this.transports.push(transport);
  }

  private async log(
    level: LogLevel,
    message: string,
    metadata?: Record<string, any>,
    error?: Error
  ): Promise<void> {
    if (level > this.logLevel) {
      return; // Skip logging if level is lower than configured threshold
    }

    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      service: this.service,
      metadata,
      stack: error?.stack,
    };

    // Add request context if available
    if (typeof window === 'undefined') {
      // Server-side: try to get request context from async local storage or headers
      try {
        // This would be set by middleware in a real application
        const globalAny = global as any;
        const requestId = globalAny.__REQUEST_ID__;
        const userId = globalAny.__USER_ID__;
        
        if (requestId) entry.requestId = requestId;
        if (userId) entry.userId = userId;
      } catch {
        // Context not available
      }
    }

    // Log to all transports concurrently
    const promises = this.transports.map(transport => 
      transport.log(entry).catch(error => 
        console.error(`Transport failed for ${this.service}:`, error)
      )
    );
    
    await Promise.allSettled(promises);
  }

  async error(message: string, metadata?: Record<string, any>, error?: Error): Promise<void> {
    await this.log(LogLevel.ERROR, message, metadata, error);
  }

  async warn(message: string, metadata?: Record<string, any>): Promise<void> {
    await this.log(LogLevel.WARN, message, metadata);
  }

  async info(message: string, metadata?: Record<string, any>): Promise<void> {
    await this.log(LogLevel.INFO, message, metadata);
  }

  async debug(message: string, metadata?: Record<string, any>): Promise<void> {
    await this.log(LogLevel.DEBUG, message, metadata);
  }

  // Convenience methods for common scenarios
  async apiRequest(
    method: string,
    path: string,
    statusCode: number,
    duration: number,
    metadata?: Record<string, any>
  ): Promise<void> {
    const level = statusCode >= 500 ? LogLevel.ERROR : 
                  statusCode >= 400 ? LogLevel.WARN : LogLevel.INFO;
    
    await this.log(level, `API ${method} ${path} - ${statusCode}`, {
      ...metadata,
      method,
      path,
      statusCode,
      duration,
      type: 'api_request'
    });
  }

  async userAction(
    userId: string,
    action: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    await this.log(LogLevel.INFO, `User action: ${action}`, {
      ...metadata,
      userId,
      action,
      type: 'user_action'
    });
  }

  async performance(
    operation: string,
    duration: number,
    metadata?: Record<string, any>
  ): Promise<void> {
    const level = duration > 5000 ? LogLevel.WARN : LogLevel.INFO;
    
    await this.log(level, `Performance: ${operation} took ${duration}ms`, {
      ...metadata,
      operation,
      duration,
      type: 'performance'
    });
  }

  async security(
    event: string,
    severity: 'low' | 'medium' | 'high' | 'critical',
    metadata?: Record<string, any>
  ): Promise<void> {
    const level = severity === 'critical' || severity === 'high' ? LogLevel.ERROR : LogLevel.WARN;
    
    await this.log(level, `Security event: ${event}`, {
      ...metadata,
      event,
      severity,
      type: 'security'
    });
  }
}

// Pre-configured loggers for different services
export const apiLogger = new Logger('api', LogLevel.INFO);
export const dbLogger = new Logger('database', LogLevel.INFO);
export const authLogger = new Logger('auth', LogLevel.INFO);
export const speechLogger = new Logger('speech', LogLevel.INFO);
export const debateLogger = new Logger('debate', LogLevel.INFO);
export const wikiLogger = new Logger('wiki', LogLevel.INFO);

// Request middleware logger
export const requestLogger = new Logger('request', LogLevel.INFO);

// Global error logger
export const errorLogger = new Logger('error', LogLevel.ERROR);

// Helper function to create service-specific loggers
export function createLogger(service: string, level: LogLevel = LogLevel.INFO): Logger {
  return new Logger(service, level);
}

// Performance monitoring helpers
export class PerformanceMonitor {
  private startTime: number;
  private logger: Logger;
  private operation: string;

  constructor(logger: Logger, operation: string) {
    this.startTime = Date.now();
    this.logger = logger;
    this.operation = operation;
  }

  async finish(metadata?: Record<string, any>): Promise<void> {
    const duration = Date.now() - this.startTime;
    await this.logger.performance(this.operation, duration, metadata);
  }
}

// Types are already exported above through the interface declarations

// Global error handler setup
if (typeof window === 'undefined') {
  // Server-side error handling
  process.on('uncaughtException', async (error) => {
    await errorLogger.error('Uncaught exception', { error: error.message }, error);
    process.exit(1);
  });

  process.on('unhandledRejection', async (reason, promise) => {
    await errorLogger.error('Unhandled promise rejection', { 
      reason: reason instanceof Error ? reason.message : String(reason),
      promise: String(promise)
    }, reason instanceof Error ? reason : undefined);
  });
}