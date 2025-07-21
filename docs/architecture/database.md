# Eris Debate Database Architecture

## Supabase Schema Overview

```sql
-- Core Tables
public.debate_sessions        -- Main debate session records
public.debate_speeches        -- Individual speeches in debates
public.audio_recordings       -- Audio file references
public.user_preferences       -- User settings and preferences
public.speech_feedback        -- Speech analysis results
public.saved_searches         -- User's saved evidence searches
public.health_check          -- System health monitoring

-- Authentication (managed by Supabase)
auth.users                   -- User accounts
auth.sessions                -- Active sessions
```

## Row Level Security (RLS) Policies

All tables implement RLS for data isolation:

```sql
-- Example: Debate sessions policy
CREATE POLICY "debate_sessions_user_access" ON public.debate_sessions
    FOR ALL
    USING (
        auth.uid() IS NOT NULL AND (
            user_id = auth.uid() OR 
            user_id IS NULL -- Legacy data support
        )
    );

-- Example: Audio recordings policy
CREATE POLICY "audio_recordings_user_access" ON public.audio_recordings
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.debate_sessions
            WHERE debate_sessions.id = audio_recordings.session_id
            AND debate_sessions.user_id = auth.uid()
        )
    );
```

## Database Indexes

Strategic indexes for performance:

```sql
-- User data access
CREATE INDEX idx_debate_sessions_user_id ON debate_sessions(user_id);
CREATE INDEX idx_user_preferences_user_id ON user_preferences(user_id);

-- Foreign key relationships
CREATE INDEX idx_debate_speeches_session_id ON debate_speeches(session_id);
CREATE INDEX idx_audio_recordings_session_id ON audio_recordings(session_id);

-- Search optimization
CREATE INDEX idx_saved_searches_user_created ON saved_searches(user_id, created_at DESC);
```

## Deployment Architecture

### Container Architecture

```
┌─────────────────────────────────────────────────────┐
│              Docker Container                        │
├─────────────────────────────────────────────────────┤
│  Multi-stage Build:                                  │
│  1. Dependencies installation                        │
│  2. Application build                               │
│  3. Production runtime (~150MB)                     │
├─────────────────────────────────────────────────────┤
│  Runtime Environment:                                │
│  - Node.js 18 Alpine                               │
│  - Non-root user execution                         │
│  - Health check endpoints                           │
│  - Environment variable injection                   │
└─────────────────────────────────────────────────────┘
```

### CI/CD Pipeline

```
GitHub Actions Workflows:
├── test.yml          # Unit tests & type checking
├── lint.yml          # Code quality checks
├── security.yml      # Dependency scanning
├── build.yml         # Docker image building
├── deploy.yml        # Production deployment
├── e2e.yml          # End-to-end testing
├── performance.yml   # Performance benchmarks
├── backup.yml        # Database backups
└── rollback.yml      # Emergency rollback
```

### Production Infrastructure

```
┌─────────────────────────────────────────────────────┐
│           Production Architecture                    │
├─────────────────────────────────────────────────────┤
│  Load Balancer                                      │
│  ├── HTTPS termination                             │
│  ├── Request routing                               │
│  └── Health monitoring                             │
├─────────────────────────────────────────────────────┤
│  Application Servers (Auto-scaling)                  │
│  ├── Next.js instances                             │
│  ├── Socket.IO servers                             │
│  └── Shared Redis for sessions                     │
├─────────────────────────────────────────────────────┤
│  Monitoring & Observability                          │
│  ├── OpenTelemetry traces                          │
│  ├── Sentry error tracking                         │
│  ├── Grafana dashboards                            │
│  └── CloudWatch logs                               │
└─────────────────────────────────────────────────────┘
```

### Monitoring Architecture

```
Application Metrics:
├── Performance
│   ├── Response times
│   ├── API latency
│   └── WebSocket stability
├── Business Metrics
│   ├── Active debates
│   ├── Speech analyses
│   └── Search queries
├── Infrastructure
│   ├── CPU/Memory usage
│   ├── Database connections
│   └── External API calls
└── Errors & Alerts
    ├── Error rates
    ├── Failed API calls
    └── Service degradation
```