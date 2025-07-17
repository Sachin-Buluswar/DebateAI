# DebateAI Production Monitoring Guide

## Overview

DebateAI uses a comprehensive monitoring stack combining OpenTelemetry, Sentry, and custom instrumentation to ensure application reliability and performance.

## Architecture

### Components

1. **OpenTelemetry**: Distributed tracing and metrics collection
2. **Sentry**: Error tracking and performance monitoring
3. **Custom Instrumentation**: Application-specific metrics and monitoring
4. **Health Checks**: Comprehensive health and readiness probes

## Setup Instructions

### 1. Environment Variables

Add the following to your `.env` file:

```env
# OpenTelemetry
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
OTEL_SERVICE_NAME=debateai
ENABLE_OTEL_DEV=false  # Set to true to enable in development

# Sentry
SENTRY_DSN=your_sentry_dsn_here
NEXT_PUBLIC_SENTRY_DSN=your_sentry_dsn_here
ENABLE_SENTRY_DEV=false  # Set to true to enable in development

# Monitoring
MONITORING_ENDPOINT=https://your-monitoring-endpoint.com
LOG_LEVEL=info  # debug, info, warn, error, fatal
```

### 2. Initialize Monitoring

The monitoring system is automatically initialized, but you can manually initialize it in your application:

```typescript
// In your server initialization
import { initializeOpenTelemetry } from '@/lib/monitoring/opentelemetry';
import { initializeMonitoring } from '@/lib/monitoring';

// Initialize OpenTelemetry
initializeOpenTelemetry();

// Initialize general monitoring
initializeMonitoring();
```

### 3. Deploy Monitoring Infrastructure

#### Using Docker Compose

```yaml
version: '3.8'

services:
  # OpenTelemetry Collector
  otel-collector:
    image: otel/opentelemetry-collector-contrib:latest
    command: ["--config=/etc/otel-collector-config.yaml"]
    volumes:
      - ./monitoring/otel/collector-config.yaml:/etc/otel-collector-config.yaml
    ports:
      - "4318:4318"   # OTLP HTTP
      - "4317:4317"   # OTLP gRPC
      - "8888:8888"   # Prometheus metrics

  # Prometheus
  prometheus:
    image: prom/prometheus:latest
    volumes:
      - ./monitoring/prometheus/prometheus.yml:/etc/prometheus/prometheus.yml
      - ./monitoring/alerts/rules.yml:/etc/prometheus/rules.yml
    ports:
      - "9090:9090"

  # Grafana
  grafana:
    image: grafana/grafana:latest
    volumes:
      - ./monitoring/grafana/dashboards:/var/lib/grafana/dashboards
      - ./monitoring/grafana/provisioning:/etc/grafana/provisioning
    ports:
      - "3000:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
```

## Monitoring Endpoints

### Health Checks

- **GET /api/monitoring/health** - Comprehensive health check
- **HEAD /api/monitoring/health** - Simple liveness probe
- **POST /api/monitoring/health** - Readiness probe

Example response:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00Z",
  "version": "0.1.0",
  "environment": "production",
  "uptime": 3600,
  "checks": [
    {
      "service": "supabase",
      "status": "healthy",
      "responseTime": 45
    },
    {
      "service": "openai",
      "status": "healthy",
      "responseTime": 120
    }
  ],
  "resources": {
    "memory": {
      "used": 104857600,
      "total": 536870912,
      "percentage": 19.5
    }
  }
}
```

### Metrics

- **GET /api/monitoring/metrics** - Application metrics in JSON format
- **POST /api/monitoring/metrics** - Prometheus-compatible metrics

Query parameters:
- `period`: Time period for metrics (15m, 1h, 24h)

## Custom Metrics

### Application Metrics

```typescript
import { debateMetrics } from '@/lib/monitoring/opentelemetry';

// Track debate sessions
debateMetrics.debateSessions.add(1, {
  'user.id': userId,
  'debate.topic': topic
});

// Track AI responses
debateMetrics.aiResponses.add(1, {
  'ai.service': 'openai'
});

// Track errors
debateMetrics.errors.add(1, {
  'error.type': 'API_ERROR',
  'service.name': 'debate'
});
```

### Performance Monitoring

```typescript
import { usePerformanceMonitor } from '@/hooks/usePerformanceMonitor';

function MyComponent() {
  const { timeAsync, mark, measure } = usePerformanceMonitor({
    componentName: 'DebateStage',
    reportThreshold: 1000
  });

  const handleDebateStart = async () => {
    mark('debate-start');
    
    await timeAsync('ai-response', async () => {
      // AI response logic
    });
    
    mark('debate-ready');
    measure('debate-setup', 'debate-start', 'debate-ready');
  };
}
```

## Alert Configuration

Alerts are configured in `monitoring/alerts/rules.yml`. Key alerts include:

### Critical Alerts
- Application down
- Database connection failure
- AI service failures
- High error rate

### Warning Alerts
- High memory usage (>90%)
- High CPU usage (>80%)
- Slow API responses (>2s)
- WebSocket connection spikes

### Info Alerts
- Low debate activity
- Low completion rates

## Dashboards

### Grafana Dashboards

Import the provided dashboards:
1. **DebateAI Overview** - System health and key metrics
2. **Performance Dashboard** - Response times and throughput
3. **Business Metrics** - User activity and feature usage
4. **Error Analysis** - Error trends and debugging

### Key Metrics to Monitor

1. **System Health**
   - Application uptime
   - CPU and memory usage
   - Active connections

2. **Performance**
   - API response times (p50, p95, p99)
   - Database query performance
   - AI service latency

3. **Business Metrics**
   - Active debates
   - User engagement
   - Feature adoption

4. **Errors**
   - Error rate by type
   - Failed API calls
   - User-facing errors

## Troubleshooting

### Common Issues

1. **High Memory Usage**
   - Check for memory leaks in Socket.IO handlers
   - Review audio processing buffers
   - Analyze heap snapshots

2. **Slow API Responses**
   - Check database query performance
   - Review AI service response times
   - Analyze request queuing

3. **WebSocket Issues**
   - Monitor connection count
   - Check for connection leaks
   - Review event handling performance

### Debug Endpoints

- **GET /api/debug** - Debug information (requires DEBUG_API_KEY)
- **GET /api/monitoring/health?verbose=true** - Detailed health information

## Performance Baselines

### Expected Performance Metrics

| Metric | Good | Acceptable | Poor |
|--------|------|------------|------|
| API Response Time (p95) | <500ms | <2s | >2s |
| AI Response Time | <1.5s | <3s | >3s |
| WebSocket Latency | <50ms | <200ms | >200ms |
| Memory Usage | <50% | <80% | >80% |
| Error Rate | <0.1% | <1% | >1% |

### Load Testing Results

- **Concurrent Users**: 1000
- **Debates per Hour**: 500
- **Messages per Second**: 100
- **CPU Usage**: 40% average
- **Memory Usage**: 350MB average

## Incident Response

### Alert Response Playbook

1. **Application Down**
   - Check deployment status
   - Review recent changes
   - Check dependencies health
   - Rollback if necessary

2. **High Error Rate**
   - Check error logs in Sentry
   - Identify error patterns
   - Review recent deployments
   - Apply hotfix if needed

3. **Performance Degradation**
   - Check resource usage
   - Review slow queries
   - Analyze traffic patterns
   - Scale resources if needed

### Monitoring Checklist

Daily:
- [ ] Review error trends
- [ ] Check performance metrics
- [ ] Monitor resource usage

Weekly:
- [ ] Analyze user activity patterns
- [ ] Review slow endpoints
- [ ] Check alert effectiveness

Monthly:
- [ ] Performance baseline review
- [ ] Alert threshold adjustments
- [ ] Dashboard updates

## Integration with CI/CD

### GitHub Actions Integration

```yaml
- name: Run Performance Tests
  run: npm run test:performance
  
- name: Check Performance Regression
  uses: benchmark-action/github-action-benchmark@v1
  with:
    tool: 'customBiggerIsBetter'
    output-file-path: performance-results.json
    fail-on-alert: true
```

### Deployment Monitoring

1. **Pre-deployment Checks**
   - Health check validation
   - Performance baseline capture

2. **Post-deployment Monitoring**
   - Error rate monitoring (15 min)
   - Performance comparison
   - User impact assessment

## Security Considerations

1. **Sensitive Data**: Never log or send sensitive user data to monitoring services
2. **API Keys**: Use separate keys for monitoring services
3. **Access Control**: Limit access to monitoring dashboards
4. **Data Retention**: Configure appropriate retention policies

## Maintenance

### Regular Tasks

1. **Log Rotation**: Implement log rotation to prevent disk space issues
2. **Metric Cleanup**: Remove unused metrics to reduce storage
3. **Alert Tuning**: Regularly review and adjust alert thresholds
4. **Dashboard Updates**: Keep dashboards aligned with new features

### Monitoring System Health

Monitor the monitoring system itself:
- OpenTelemetry Collector health
- Prometheus storage usage
- Grafana performance
- Sentry quota usage