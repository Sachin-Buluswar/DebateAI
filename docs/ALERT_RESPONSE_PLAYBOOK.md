# DebateAI Alert Response Playbook

## Overview

This playbook provides step-by-step instructions for responding to production alerts. Each alert type includes severity, expected response time, and detailed remediation steps.

## Alert Severity Levels

- **🔴 Critical**: Immediate response required (< 15 minutes)
- **🟡 Warning**: Response within 1 hour
- **🔵 Info**: Review within business hours

## Critical Alerts

### 🔴 ApplicationDown

**Description**: The DebateAI application is not responding to health checks.

**Impact**: Complete service outage - users cannot access the application.

**Response Steps**:

1. **Immediate Actions** (< 5 min)
   ```bash
   # Check application status
   curl -I https://debateai.com/api/health
   
   # Check server logs
   kubectl logs -n production -l app=debateai --tail=100
   
   # Check recent deployments
   kubectl rollout history deployment/debateai -n production
   ```

2. **Diagnosis** (5-10 min)
   - Check deployment status in Kubernetes/hosting platform
   - Review error logs in Sentry
   - Check database connectivity
   - Verify environment variables

3. **Remediation**
   - If recent deployment: Rollback immediately
     ```bash
     kubectl rollout undo deployment/debateai -n production
     ```
   - If infrastructure issue: Contact cloud provider
   - If database issue: Check Supabase status page

4. **Post-Incident**
   - Create incident report
   - Update monitoring to catch issue earlier
   - Schedule post-mortem meeting

### 🔴 DatabaseConnectionFailure

**Description**: Cannot connect to Supabase database.

**Impact**: Application cannot read/write data, debates will fail.

**Response Steps**:

1. **Verify Issue**
   ```bash
   # Test database connection
   psql $DATABASE_URL -c "SELECT 1"
   
   # Check Supabase status
   curl https://status.supabase.com/api/v2/status.json
   ```

2. **Immediate Mitigation**
   - Enable read-only mode if possible
   - Queue write operations
   - Display maintenance message

3. **Resolution**
   - Check connection pool settings
   - Verify database credentials
   - Review firewall rules
   - Contact Supabase support if needed

### 🔴 AIServiceErrors

**Description**: OpenAI or ElevenLabs APIs are failing.

**Impact**: No AI responses, debates cannot function properly.

**Response Steps**:

1. **Identify Affected Service**
   ```bash
   # Check OpenAI
   curl -H "Authorization: Bearer $OPENAI_API_KEY" \
     https://api.openai.com/v1/models
   
   # Check ElevenLabs
   curl -H "xi-api-key: $ELEVENLABS_API_KEY" \
     https://api.elevenlabs.io/v1/models
   ```

2. **Implement Fallbacks**
   - Enable cached responses if available
   - Switch to backup AI provider
   - Reduce AI feature complexity temporarily

3. **Monitor and Communicate**
   - Check provider status pages
   - Notify users of degraded functionality
   - Monitor API quotas and rate limits

## Warning Alerts

### 🟡 HighMemoryUsage

**Description**: Application memory usage exceeds 90%.

**Impact**: Potential crashes, slow performance.

**Response Steps**:

1. **Analyze Memory Usage**
   ```bash
   # Get memory metrics
   kubectl top pods -n production
   
   # Check for memory leaks
   curl https://debateai.com/api/monitoring/metrics | jq '.resources.memory'
   ```

2. **Immediate Actions**
   - Restart pods with high memory one at a time
   - Clear any caches
   - Reduce connection pool sizes

3. **Investigation**
   - Review recent code changes
   - Check for WebSocket connection leaks
   - Analyze heap dumps
   - Look for unbounded data structures

### 🟡 SlowAPIResponses

**Description**: API response times exceed 2 seconds.

**Impact**: Poor user experience, potential timeouts.

**Response Steps**:

1. **Identify Slow Endpoints**
   ```bash
   # Check performance metrics
   curl https://debateai.com/api/monitoring/metrics?period=15m | \
     jq '.performance.api.slowRequests'
   ```

2. **Quick Fixes**
   - Increase cache TTL
   - Reduce query complexity
   - Enable response compression

3. **Optimization**
   - Add database indexes
   - Implement query optimization
   - Review N+1 queries
   - Consider caching strategy

### 🟡 HighWebSocketConnections

**Description**: Active WebSocket connections exceed 5000.

**Impact**: Resource exhaustion, connection failures.

**Response Steps**:

1. **Analyze Connections**
   ```bash
   # Get connection metrics
   curl https://debateai.com/api/monitoring/metrics | \
     jq '.resources.connections.websocket'
   ```

2. **Mitigation**
   - Implement connection limits
   - Close idle connections
   - Scale WebSocket servers

3. **Prevention**
   - Review connection lifecycle
   - Implement proper cleanup
   - Add connection pooling

## Info Alerts

### 🔵 LowDebateActivity

**Description**: Fewer debates than expected.

**Response Steps**:
1. Check for user-facing errors
2. Review marketing campaigns
3. Analyze user feedback

### 🔵 RateLimitingActive

**Description**: Many requests being rate-limited.

**Response Steps**:
1. Identify affected users/IPs
2. Check for abuse patterns
3. Adjust rate limits if needed

## Escalation Matrix

| Alert Type | First Responder | Escalation (30 min) | Escalation (1 hr) |
|------------|----------------|---------------------|-------------------|
| Critical | On-call Engineer | Tech Lead | CTO |
| Warning | On-call Engineer | Tech Lead | - |
| Info | Support Team | On-call Engineer | - |

## Communication Templates

### Status Page Update
```
We are currently experiencing [ISSUE DESCRIPTION]. 
Impact: [USER IMPACT]
We are actively working on a resolution. 
Next update in 30 minutes.
```

### Internal Slack Alert
```
🚨 Alert: [ALERT NAME]
Severity: [CRITICAL/WARNING/INFO]
Impact: [DESCRIPTION]
Responder: @[NAME]
Thread for updates 👇
```

### Post-Incident Customer Email
```
Subject: Service Disruption - [DATE]

Dear Customer,

On [DATE] between [START] and [END], DebateAI experienced [ISSUE].

Impact:
- [IMPACT POINT 1]
- [IMPACT POINT 2]

Resolution:
[WHAT WAS DONE]

Prevention:
[FUTURE PREVENTION STEPS]

We apologize for any inconvenience.

The DebateAI Team
```

## Tools and Resources

### Monitoring Dashboards
- Grafana: https://grafana.debateai.com
- Sentry: https://sentry.io/organizations/debateai
- Supabase: https://app.supabase.com/project/[PROJECT_ID]

### Useful Commands

```bash
# Get application logs
kubectl logs -n production -l app=debateai --tail=1000

# Check pod status
kubectl get pods -n production

# Force restart
kubectl rollout restart deployment/debateai -n production

# Scale deployment
kubectl scale deployment/debateai --replicas=5 -n production

# Get recent errors from Sentry
curl -H "Authorization: Bearer $SENTRY_AUTH_TOKEN" \
  "https://sentry.io/api/0/projects/debateai/web/issues/"

# Check Supabase health
curl -H "apikey: $SUPABASE_SERVICE_KEY" \
  "$SUPABASE_URL/rest/v1/"
```

### Emergency Contacts

- **Supabase Support**: support@supabase.com
- **OpenAI Support**: https://help.openai.com
- **ElevenLabs Support**: support@elevenlabs.io
- **Cloud Provider**: [Your provider's support]

## Post-Incident Process

1. **Incident Timeline**: Document what happened when
2. **Root Cause Analysis**: Identify the underlying cause
3. **Impact Assessment**: Quantify user impact
4. **Action Items**: List preventive measures
5. **Post-Mortem Meeting**: Schedule within 48 hours
6. **Documentation Update**: Update runbooks and alerts

## Best Practices

1. **Always announce** when you're responding to an alert
2. **Keep communication flowing** - update every 30 minutes
3. **Document everything** - commands run, changes made
4. **Test fixes** in staging before production when possible
5. **Follow up** - ensure the issue is fully resolved

## Alert Tuning Guidelines

Review alerts monthly for:
- False positive rate (should be < 5%)
- Alert actionability (can you fix it?)
- Threshold appropriateness
- Missing alerts for recent incidents

Remember: The goal is to have alerts that are **actionable**, **accurate**, and **timely**.