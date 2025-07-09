# Monitoring and Observability Guide

This guide explains how to use the comprehensive monitoring system implemented in DebateAI.

## Overview

The monitoring system provides:
- **Structured Logging** - Consistent log formatting with context
- **Error Tracking** - Centralized error handling and reporting
- **Performance Monitoring** - Track API response times and slow operations
- **Rate Limiting** - Protect endpoints from abuse
- **Request Tracing** - Track requests across the system

## Quick Start

### 1. Basic API Route with Monitoring

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { withMonitoring } from '@/lib/monitoring';

export const GET = withMonitoring(async (request: NextRequest) => {
  // Your API logic here
  return NextResponse.json({ success: true });
});
```

### 2. Add Rate Limiting

```typescript
import { withMonitoring, withRateLimit, composeMiddleware } from '@/lib/monitoring';

export const POST = composeMiddleware(
  withMonitoring,
  withRateLimit({ maxAttempts: 5, windowMs: 60000 })
)(async (request: NextRequest) => {
  // Your API logic here
  return NextResponse.json({ success: true });
});
```

### 3. Use Structured Logging

```typescript
import { apiLogger } from '@/lib/monitoring';

// Basic logging
apiLogger.info('User logged in', { userId: user.id });

// With context
apiLogger.error('Payment failed', error, {
  userId: user.id,
  amount: 99.99,
  currency: 'USD'
});
```

## Component Reference

### Loggers

Pre-configured loggers for different services:

```typescript
import { 
  apiLogger,      // For API routes
  dbLogger,       // For database operations
  authLogger,     // For authentication
  aiLogger,       // For AI services
  socketLogger    // For WebSocket events
} from '@/lib/monitoring';
```

### Error Handling

Use `AppError` for controlled error responses:

```typescript
import { AppError, ErrorTypes } from '@/lib/monitoring';

// Throw a predefined error
throw new AppError(ErrorTypes.UNAUTHORIZED);

// Custom error with details
throw new AppError({
  code: 'CUSTOM_ERROR',
  message: 'Something went wrong',
  statusCode: 400,
  retryable: false,
  userMessage: 'Please try again later',
  metadata: { details: 'Additional info' }
});
```

### Performance Tracking

Track operation performance:

```typescript
import { apiPerformance, dbPerformance } from '@/lib/monitoring';

// Track API endpoint
apiPerformance.startTimer('process-payment');
// ... do work ...
apiPerformance.endTimer('process-payment');

// Track async operations
const result = await dbPerformance.trackQuery(
  'fetch-user',
  () => supabase.from('users').select('*').eq('id', userId),
  { userId }
);
```

## Integration Examples

### API Route with Full Monitoring

```typescript
import { NextRequest, NextResponse } from 'next/server';
import {
  withMonitoring,
  withRateLimit,
  composeMiddleware,
  AppError,
  ErrorTypes,
  createRequestLogger,
  dbPerformance
} from '@/lib/monitoring';

export const POST = composeMiddleware(
  withMonitoring,
  withRateLimit({ maxAttempts: 10, windowMs: 60000 })
)(async (request: NextRequest) => {
  const requestId = request.headers.get('x-request-id') || 'unknown';
  const logger = createRequestLogger(requestId);

  try {
    logger.info('Processing payment request');

    const body = await request.json();
    
    // Validate input
    if (!body.amount) {
      throw new AppError({
        ...ErrorTypes.INVALID_INPUT,
        userMessage: 'Amount is required'
      });
    }

    // Track database operation
    const user = await dbPerformance.trackQuery(
      'fetch-user-for-payment',
      async () => {
        // Database query here
      }
    );

    logger.info('Payment processed successfully', {
      metadata: { amount: body.amount }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    // Automatically handled by monitoring middleware
    throw error;
  }
});
```

### WebSocket Event Monitoring

```typescript
import { socketLogger } from '@/lib/monitoring';

io.on('connection', (socket) => {
  socketLogger.info('Client connected', {
    metadata: { socketId: socket.id }
  });

  socket.on('message', (data) => {
    const timer = socketLogger.time('process-message');
    
    try {
      // Process message
      timer(); // Logs duration
    } catch (error) {
      socketLogger.error('Message processing failed', error);
    }
  });
});
```

## Best Practices

### 1. Use Appropriate Log Levels

- **DEBUG**: Detailed information for debugging
- **INFO**: General informational messages
- **WARN**: Warning messages for potential issues
- **ERROR**: Error messages for failures
- **FATAL**: Critical errors that may cause system failure

### 2. Include Context

Always include relevant context in logs:

```typescript
logger.info('Order processed', {
  userId: user.id,
  orderId: order.id,
  amount: order.total,
  metadata: {
    paymentMethod: 'stripe',
    currency: 'USD'
  }
});
```

### 3. Track Performance Metrics

Set appropriate thresholds for different operations:

```typescript
// Database queries: 500ms threshold
dbPerformance.trackQuery('complex-query', queryFn, {}, 500);

// External APIs: 3000ms threshold
openaiPerformance.trackAPICall('generate-text', apiFn, {}, 3000);

// Internal processing: 1000ms threshold
apiPerformance.timeAsync('process-data', processFn, {}, 1000);
```

### 4. Handle Errors Gracefully

```typescript
try {
  // Risky operation
} catch (error) {
  if (error instanceof AppError) {
    // Already formatted, just throw
    throw error;
  }
  
  // Map to appropriate error type
  if (error.message.includes('rate limit')) {
    throw new AppError(ErrorTypes.RATE_LIMITED);
  }
  
  // Default to internal error
  throw new AppError({
    ...ErrorTypes.INTERNAL_ERROR,
    metadata: { originalError: error.message }
  });
}
```

## Environment Variables

Configure monitoring behavior:

```env
# Log level: debug, info, warn, error, fatal
LOG_LEVEL=info

# Monitoring endpoint (optional)
MONITORING_ENDPOINT=https://your-monitoring-service.com/logs

# Performance thresholds (ms)
SLOW_API_THRESHOLD=1000
SLOW_DB_THRESHOLD=500
```

## Production Considerations

### 1. Log Aggregation

In production, logs are formatted as JSON for easy parsing:

```json
{
  "timestamp": "2024-01-01T00:00:00.000Z",
  "level": "info",
  "message": "User logged in",
  "service": "api",
  "environment": "production",
  "context": {
    "userId": "123",
    "requestId": "abc-def-ghi"
  }
}
```

### 2. Error Reporting

Critical errors are automatically sent to monitoring services when configured:

- Set `MONITORING_ENDPOINT` environment variable
- Integrate with services like Sentry, DataDog, or New Relic
- Errors include full context and stack traces

### 3. Performance Monitoring

- Slow operations are automatically logged with warnings
- Performance reports can be generated on demand
- Integrate with APM tools for visualization

### 4. Security

- Never log sensitive data (passwords, API keys, etc.)
- Use `metadata` field for additional context
- Sanitize user input before logging

## Troubleshooting

### Logs Not Appearing

1. Check `LOG_LEVEL` environment variable
2. Ensure logger is imported correctly
3. Verify Node.js console is not being overridden

### Performance Issues

1. Reduce log verbosity in production
2. Use async logging for high-traffic endpoints
3. Implement log sampling for very high volume

### Rate Limiting Issues

1. Adjust `windowMs` and `maxAttempts` as needed
2. Use custom identifiers for more granular control
3. Monitor rate limit metrics in logs

## Future Enhancements

- OpenTelemetry integration for distributed tracing
- Custom dashboards for monitoring metrics
- Automated alerting based on error patterns
- Machine learning for anomaly detection