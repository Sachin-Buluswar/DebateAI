/**
 * Example API route with comprehensive monitoring
 * This demonstrates how to integrate logging, error tracking, and performance monitoring
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  withMonitoring,
  withRateLimit,
  composeMiddleware,
  AppError,
  ErrorTypes,
  openaiPerformance,
  createRequestLogger
} from '@/lib/monitoring';

// Compose middleware for this route
const middleware = composeMiddleware(
  withMonitoring,
  withRateLimit({
    windowMs: 60000, // 1 minute
    maxAttempts: 10  // 10 requests per minute
  })
);

// Example handler with monitoring
export const POST = middleware(async (request: NextRequest) => {
  // Extract request ID from headers (set by monitoring middleware)
  const requestId = request.headers.get('x-request-id') || 'unknown';
  const logger = createRequestLogger(requestId);

  try {
    // Log the start of processing
    logger.info('Processing example request');

    // Parse and validate request body
    const body = await request.json();
    
    if (!body.message) {
      throw new AppError({
        ...ErrorTypes.MISSING_REQUIRED_FIELD,
        userMessage: 'Message field is required'
      });
    }

    // Example: Track external API call performance
    const aiResponse = await openaiPerformance.trackAPICall(
      'chat.completions',
      async () => {
        // Simulate API call
        logger.debug('Calling OpenAI API', { metadata: { prompt: body.message } });
        
        // In real implementation, this would call OpenAI
        await new Promise(resolve => setTimeout(resolve, 100));
        
        return { response: 'AI response here' };
      },
      { promptLength: body.message.length }
    );

    // Log successful processing
    logger.info('Request processed successfully', {
      metadata: {
        responseLength: aiResponse.response.length
      }
    });

    // Return successful response
    return NextResponse.json({
      success: true,
      data: {
        message: body.message,
        aiResponse: aiResponse.response,
        requestId
      }
    });

  } catch (error) {
    // Error will be automatically logged and tracked by monitoring middleware
    throw error;
  }
});

// Example GET endpoint with different configuration
export const GET = composeMiddleware(
  withMonitoring,
  withRateLimit({
    windowMs: 60000,
    maxAttempts: 30, // Higher limit for GET requests
    identifier: (req) => {
      // Custom identifier: combination of IP and user agent
      const ip = req.headers.get('x-forwarded-for') || 'unknown';
      const userAgent = req.headers.get('user-agent') || 'unknown';
      return `${ip}:${userAgent}`;
    }
  })
)(async (request: NextRequest) => {
  const requestId = request.headers.get('x-request-id') || 'unknown';
  const logger = createRequestLogger(requestId);

  logger.info('Handling GET request');

  // Example: Return monitoring status
  const status = {
    service: 'example-monitored',
    status: 'healthy',
    timestamp: new Date().toISOString(),
    requestId,
    monitoring: {
      logging: true,
      errorTracking: true,
      performanceMonitoring: true,
      rateLimit: {
        limit: 30,
        window: '1 minute'
      }
    }
  };

  return NextResponse.json(status);
});

/**
 * This example demonstrates:
 * 
 * 1. Middleware composition for monitoring and rate limiting
 * 2. Request-specific logging with context
 * 3. Error handling with custom error types
 * 4. Performance tracking for external API calls
 * 5. Different configurations for different HTTP methods
 * 
 * To use in your own routes:
 * 
 * 1. Import the monitoring utilities
 * 2. Wrap your handler with the appropriate middleware
 * 3. Use the logger for structured logging
 * 4. Throw AppError for controlled error responses
 * 5. Track performance of slow operations
 */