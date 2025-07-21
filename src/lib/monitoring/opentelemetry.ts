/**
 * OpenTelemetry instrumentation setup for Eris Debate
 * Provides distributed tracing and metrics collection
 */

import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { resourceFromAttributes } from '@opentelemetry/resources';
import {
  SEMRESATTRS_SERVICE_NAME,
  SEMRESATTRS_SERVICE_VERSION,
  SEMRESATTRS_DEPLOYMENT_ENVIRONMENT,
} from '@opentelemetry/semantic-conventions';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { trace, context, SpanStatusCode, Span } from '@opentelemetry/api';
import { apiLogger } from './logger';

// Configuration
const OTEL_EXPORTER_OTLP_ENDPOINT = process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318';
const SERVICE_NAME = process.env.OTEL_SERVICE_NAME || 'eris-debate';
const SERVICE_VERSION = process.env.npm_package_version || '0.1.0';
const ENVIRONMENT = process.env.NODE_ENV || 'development';

// Create resource
const resource = resourceFromAttributes({
  [SEMRESATTRS_SERVICE_NAME]: SERVICE_NAME,
  [SEMRESATTRS_SERVICE_VERSION]: SERVICE_VERSION,
  [SEMRESATTRS_DEPLOYMENT_ENVIRONMENT]: ENVIRONMENT,
});

// Create trace exporter
const traceExporter = new OTLPTraceExporter({
  url: `${OTEL_EXPORTER_OTLP_ENDPOINT}/v1/traces`,
  headers: process.env.OTEL_EXPORTER_OTLP_HEADERS 
    ? JSON.parse(process.env.OTEL_EXPORTER_OTLP_HEADERS)
    : {},
});

// Create metric exporter
const metricExporter = new OTLPMetricExporter({
  url: `${OTEL_EXPORTER_OTLP_ENDPOINT}/v1/metrics`,
  headers: process.env.OTEL_EXPORTER_OTLP_HEADERS 
    ? JSON.parse(process.env.OTEL_EXPORTER_OTLP_HEADERS)
    : {},
});

// Create metric reader
const metricReader = new PeriodicExportingMetricReader({
  exporter: metricExporter,
  exportIntervalMillis: 60000, // Export metrics every minute
});

// Initialize OpenTelemetry
let otelSDK: NodeSDK | null = null;

export function initializeOpenTelemetry() {
  // Skip initialization in development unless explicitly enabled
  if (process.env.NODE_ENV === 'development' && !process.env.ENABLE_OTEL_DEV) {
    apiLogger.info('OpenTelemetry disabled in development');
    return;
  }

  try {
    otelSDK = new NodeSDK({
      resource,
      traceExporter,
      metricReader,
      instrumentations: [
        getNodeAutoInstrumentations({
          // Disable fs instrumentation to reduce noise
          '@opentelemetry/instrumentation-fs': {
            enabled: false,
          },
        }),
      ],
    });

    otelSDK.start();
    apiLogger.info('OpenTelemetry initialized', {
      metadata: {
        endpoint: OTEL_EXPORTER_OTLP_ENDPOINT,
        serviceName: SERVICE_NAME,
        environment: ENVIRONMENT,
      },
    });
  } catch (error) {
    apiLogger.error('Failed to initialize OpenTelemetry', error as Error);
  }
}

// Shutdown OpenTelemetry gracefully
export async function shutdownOpenTelemetry() {
  if (otelSDK) {
    try {
      await otelSDK.shutdown();
      apiLogger.info('OpenTelemetry shutdown complete');
    } catch (error) {
      apiLogger.error('Error shutting down OpenTelemetry', error as Error);
    }
  }
}

// Utility functions for manual instrumentation
const tracer = trace.getTracer(SERVICE_NAME, SERVICE_VERSION);

/**
 * Create a custom span for tracing
 */
export function createSpan(name: string, attributes?: Record<string, any>): Span {
  const span = tracer.startSpan(name);
  if (attributes) {
    span.setAttributes(attributes);
  }
  return span;
}

/**
 * Trace an async operation
 */
export async function traceAsync<T>(
  name: string,
  operation: () => Promise<T>,
  attributes?: Record<string, any>
): Promise<T> {
  const span = createSpan(name, attributes);
  
  try {
    const result = await context.with(trace.setSpan(context.active(), span), operation);
    span.setStatus({ code: SpanStatusCode.OK });
    return result;
  } catch (error) {
    span.recordException(error as Error);
    span.setStatus({
      code: SpanStatusCode.ERROR,
      message: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  } finally {
    span.end();
  }
}

/**
 * Trace a sync operation
 */
export function traceSync<T>(
  name: string,
  operation: () => T,
  attributes?: Record<string, any>
): T {
  const span = createSpan(name, attributes);
  
  try {
    const result = context.with(trace.setSpan(context.active(), span), operation);
    span.setStatus({ code: SpanStatusCode.OK });
    return result;
  } catch (error) {
    span.recordException(error as Error);
    span.setStatus({
      code: SpanStatusCode.ERROR,
      message: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  } finally {
    span.end();
  }
}

/**
 * Add event to current span
 */
export function addSpanEvent(name: string, attributes?: Record<string, any>) {
  const span = trace.getActiveSpan();
  if (span) {
    span.addEvent(name, attributes);
  }
}

/**
 * Set attributes on current span
 */
export function setSpanAttributes(attributes: Record<string, any>) {
  const span = trace.getActiveSpan();
  if (span) {
    span.setAttributes(attributes);
  }
}

// Custom instrumentation for Socket.IO
export function instrumentSocketIO(io: any) {
  io.on('connection', (socket: any) => {
    const connectionSpan = createSpan('socket.io.connection', {
      'socket.id': socket.id,
      'socket.handshake.address': socket.handshake.address,
    });

    socket.on('disconnect', () => {
      connectionSpan.addEvent('socket.disconnected');
      connectionSpan.end();
    });

    // Instrument socket events
    const originalEmit = socket.emit;
    socket.emit = function(event: string, ...args: any[]) {
      const span = createSpan(`socket.io.emit.${event}`, {
        'socket.id': socket.id,
        'event.name': event,
      });
      
      try {
        const result = originalEmit.apply(socket, [event, ...args]);
        span.setStatus({ code: SpanStatusCode.OK });
        return result;
      } catch (error) {
        span.recordException(error as Error);
        span.setStatus({ code: SpanStatusCode.ERROR });
        throw error;
      } finally {
        span.end();
      }
    };
  });
}

// Export metrics helpers
import { metrics } from '@opentelemetry/api';

const meter = metrics.getMeter(SERVICE_NAME, SERVICE_VERSION);

// Custom metrics for Eris Debate
export const debateMetrics = {
  // Counter for debate sessions
  debateSessions: meter.createCounter('debate.sessions.total', {
    description: 'Total number of debate sessions started',
  }),
  
  // Histogram for debate duration
  debateDuration: meter.createHistogram('debate.duration', {
    description: 'Duration of debate sessions in seconds',
    unit: 's',
  }),
  
  // Counter for AI responses
  aiResponses: meter.createCounter('ai.responses.total', {
    description: 'Total number of AI responses generated',
  }),
  
  // Histogram for AI response time
  aiResponseTime: meter.createHistogram('ai.response.time', {
    description: 'Time taken to generate AI responses',
    unit: 'ms',
  }),
  
  // Counter for speech feedback sessions
  speechFeedback: meter.createCounter('speech.feedback.total', {
    description: 'Total number of speech feedback sessions',
  }),
  
  // Counter for wiki searches
  wikiSearches: meter.createCounter('wiki.searches.total', {
    description: 'Total number of wiki searches performed',
  }),
  
  // Gauge for active connections
  activeConnections: meter.createUpDownCounter('connections.active', {
    description: 'Number of active Socket.IO connections',
  }),
  
  // Counter for errors by type
  errors: meter.createCounter('errors.total', {
    description: 'Total number of errors by type',
  }),
};

// Record custom metrics
export function recordDebateStart(userId: string, topic: string) {
  debateMetrics.debateSessions.add(1, {
    'user.id': userId,
    'debate.topic': topic,
  });
}

export function recordDebateEnd(userId: string, durationSeconds: number) {
  debateMetrics.debateDuration.record(durationSeconds, {
    'user.id': userId,
  });
}

export function recordAIResponse(service: string, responseTimeMs: number) {
  debateMetrics.aiResponses.add(1, {
    'ai.service': service,
  });
  debateMetrics.aiResponseTime.record(responseTimeMs, {
    'ai.service': service,
  });
}

export function recordError(errorType: string, service: string) {
  debateMetrics.errors.add(1, {
    'error.type': errorType,
    'service.name': service,
  });
}