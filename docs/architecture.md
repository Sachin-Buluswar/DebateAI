# DebateAI Architecture Documentation

## Table of Contents
1. [System Overview](#system-overview)
2. [High-Level Architecture](#high-level-architecture)
3. [Frontend Architecture](#frontend-architecture)
4. [Backend Architecture](#backend-architecture)
5. [Database Architecture](#database-architecture)
6. [External Services Integration](#external-services-integration)
7. [Real-Time Communication](#real-time-communication)
8. [Security Architecture](#security-architecture)
9. [Deployment Architecture](#deployment-architecture)

---

## System Overview

DebateAI is a production-ready AI debate platform built with modern web technologies. The system enables real-time debates with AI opponents, provides speech analysis capabilities, and offers semantic search for debate evidence.

### Core Components

```
┌─────────────────────────────────────────────────────────────────────┐
│                            Client Layer                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐             │
│  │   Next.js    │  │   React 18   │  │  Tailwind    │             │
│  │  App Router  │  │  Components  │  │     CSS      │             │
│  └──────────────┘  └──────────────┘  └──────────────┘             │
└─────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         Application Layer                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐             │
│  │  API Routes  │  │  Socket.IO   │  │   Middleware │             │
│  │  (REST API)  │  │   Server     │  │  & Guards    │             │
│  └──────────────┘  └──────────────┘  └──────────────┘             │
└─────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         Service Layer                                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐             │
│  │    OpenAI    │  │  ElevenLabs  │  │   Supabase   │             │
│  │   Service    │  │   Service    │  │   Service    │             │
│  └──────────────┘  └──────────────┘  └──────────────┘             │
└─────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                          Data Layer                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐             │
│  │  PostgreSQL  │  │   Vector     │  │    Audio     │             │
│  │  (Supabase)  │  │   Storage    │  │   Storage    │             │
│  └──────────────┘  └──────────────┘  └──────────────┘             │
└─────────────────────────────────────────────────────────────────────┘
```

---

## High-Level Architecture

### Technology Stack

- **Frontend**: Next.js 14.2.30, React 18, TypeScript, Tailwind CSS
- **Backend**: Node.js, Next.js API Routes, Socket.IO
- **Database**: Supabase (PostgreSQL) with Row Level Security
- **AI Services**: OpenAI GPT-4o-mini, ElevenLabs TTS/STT
- **Infrastructure**: Docker, GitHub Actions, OpenTelemetry

### Key Design Principles

1. **Separation of Concerns**: Clear boundaries between UI, business logic, and data access
2. **Type Safety**: End-to-end TypeScript with Zod validation
3. **Error Recovery**: Exponential backoff and circuit breakers for external services
4. **Security First**: Input validation, rate limiting, and RLS policies
5. **Performance**: Lazy loading, server components, and connection pooling

---

## Frontend Architecture

### Next.js App Router Structure

```
src/app/
├── (auth)/                 # Authentication group
│   ├── auth/              # Login/signup pages
│   └── layout.tsx         # Auth-specific layout
├── debate/                # Real-time debate interface
│   ├── [topicId]/        # Dynamic topic routes
│   └── page.tsx          # Debate listing
├── speech-feedback/       # Speech analysis
│   └── page.tsx          # Upload/record interface
├── search/               # Evidence search
│   └── page.tsx         # Wiki search interface
└── api/                  # API routes
    ├── debate/          # Debate endpoints
    ├── speech-feedback/ # Speech processing
    └── wiki-search/     # Evidence retrieval
```

### Component Architecture

```
src/components/
├── ui/                    # Enhanced UI components
│   ├── EnhancedButton.tsx
│   ├── EnhancedInput.tsx
│   └── Toast.tsx
├── debate/               # Debate-specific components
│   ├── DebateStage/     # Main debate interface
│   ├── PhaseTimer/      # Timing controls
│   └── SpeechBubble/    # Message display
├── layout/              # App layout components
│   ├── Header/
│   ├── Navigation/
│   └── Footer/
└── monitoring/          # Error boundaries & tracking
    └── ErrorBoundary.tsx
```

### State Management

- **Server State**: React Query for API data caching
- **Client State**: React hooks for UI state
- **Real-time State**: Socket.IO event-driven updates
- **Form State**: React Hook Form with Zod validation

### Performance Optimizations

- Server Components by default
- Dynamic imports for heavy components
- Image optimization with Next.js Image
- Route prefetching and suspense boundaries

---

## Backend Architecture

### Service Layer Architecture

```
src/backend/
├── services/                  # External integrations
│   ├── openaiService.ts      # Centralized OpenAI client
│   ├── openaiClientManager.ts # Connection pooling
│   ├── elevenLabsService.ts  # TTS/STT operations
│   ├── supabaseService.ts    # Database operations
│   └── ttsService.ts         # Text-to-speech wrapper
├── modules/                   # Business logic modules
│   ├── realtimeDebate/       # Debate orchestration
│   │   ├── DebateManager.ts      # Main debate controller
│   │   ├── SocketManager.ts      # WebSocket handling
│   │   ├── ElevenLabsCrossfireManager.ts
│   │   └── ErrorRecoveryManager.ts
│   ├── speechFeedback/       # Speech analysis
│   │   └── speechFeedbackService.ts
│   └── wikiSearch/           # Evidence search
│       ├── indexingService.ts
│       ├── retrievalService.ts
│       └── generationService.ts
└── config/                   # Service configurations
    └── services.config.ts
```

### API Route Pattern

All API routes follow a standardized pattern:

```typescript
// Standard API Route Structure
export async function POST(request: Request) {
  // 1. Rate limiting
  const { success, response } = await withRateLimit(request);
  if (!success) return response;

  // 2. Input validation
  const { data, error } = await validateRequest(request, schema);
  if (error) return NextResponse.json({ error }, { status: 400 });

  // 3. Business logic with error recovery
  try {
    const result = await serviceCall(data);
    return NextResponse.json(result);
  } catch (error) {
    logger.error('API Error', { error, endpoint });
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
```

### Service Integration Pattern

```typescript
// Centralized service with retry logic
class OpenAIService {
  private manager = openAIManager;

  async generateSpeech(params: SpeechParams): Promise<SpeechResult> {
    return withRetry(
      async () => {
        const validated = speechSchema.parse(params);
        const response = await this.client.chat.completions.create(validated);
        return this.processSpeechResponse(response);
      },
      { maxRetries: 3, backoff: 'exponential' }
    );
  }
}
```

---

## Database Architecture

### Supabase Schema Overview

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

### Row Level Security (RLS) Policies

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

### Database Indexes

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

---

## External Services Integration

### OpenAI Integration Architecture

```
┌─────────────────────────────────────────────────────┐
│              OpenAI Service Layer                    │
├─────────────────────────────────────────────────────┤
│  ┌─────────────────┐    ┌─────────────────┐       │
│  │ Client Manager  │    │  Service API    │       │
│  │  - Connection   │───▶│  - Chat         │       │
│  │    pooling     │    │  - Transcription│       │
│  │  - Rate limits │    │  - Embeddings   │       │
│  └─────────────────┘    └─────────────────┘       │
├─────────────────────────────────────────────────────┤
│           Error Recovery & Monitoring                │
│  - Exponential backoff                              │
│  - Circuit breakers                                 │
│  - Cost tracking                                    │
│  - Performance metrics                              │
└─────────────────────────────────────────────────────┘
```

### ElevenLabs Integration

```
┌─────────────────────────────────────────────────────┐
│            ElevenLabs Service Layer                  │
├─────────────────────────────────────────────────────┤
│  ┌─────────────────┐    ┌─────────────────┐       │
│  │   REST API      │    │  WebSocket API  │       │
│  │  - TTS batch    │    │  - Real-time    │       │
│  │  - STT upload   │    │    streaming    │       │
│  └─────────────────┘    └─────────────────┘       │
├─────────────────────────────────────────────────────┤
│              Voice Management                        │
│  - 10 unique AI personalities                       │
│  - Voice ID mapping                                 │
│  - Audio format optimization                        │
└─────────────────────────────────────────────────────┘
```

### Vector Storage Architecture

```
┌─────────────────────────────────────────────────────┐
│          OpenAI Vector Storage Integration           │
├─────────────────────────────────────────────────────┤
│  Document Processing Pipeline:                       │
│  1. Text extraction & chunking                      │
│  2. Embedding generation (text-embedding-3-small)   │
│  3. Vector storage with metadata                    │
│  4. Semantic search & retrieval                     │
└─────────────────────────────────────────────────────┘
```

---

## Real-Time Communication

### Socket.IO Architecture

```
┌─────────────────────────────────────────────────────┐
│              Socket.IO Server                        │
├─────────────────────────────────────────────────────┤
│  Authentication Middleware:                          │
│  - JWT token validation via Supabase                │
│  - User session binding                             │
│  - Development mode bypass                          │
├─────────────────────────────────────────────────────┤
│  Event Handlers:                                     │
│  - debate:join         → Join debate room           │
│  - debate:leave        → Leave debate room          │
│  - debate:speech       → Submit speech              │
│  - debate:crossfire    → Crossfire interaction     │
│  - debate:analyze      → Request analysis           │
├─────────────────────────────────────────────────────┤
│  Room Management:                                    │
│  - Isolated debate sessions                         │
│  - Participant tracking                             │
│  - State synchronization                            │
└─────────────────────────────────────────────────────┘
```

### WebSocket Flow

```
Client                    Server                    Services
  │                         │                         │
  ├──── Connect + JWT ─────▶│                         │
  │                         ├─── Validate Token ─────▶│ Supabase
  │◀──── Authenticated ─────┤                         │
  │                         │                         │
  ├──── Join Debate ───────▶│                         │
  │                         ├─── Create Room ─────────┤
  │◀──── Room Joined ───────┤                         │
  │                         │                         │
  ├──── Submit Speech ─────▶│                         │
  │                         ├─── Generate Response ──▶│ OpenAI
  │                         ├─── Synthesize Voice ───▶│ ElevenLabs
  │◀──── AI Response ───────┤                         │
  │                         │                         │
```

---

## Security Architecture

### Authentication & Authorization

```
┌─────────────────────────────────────────────────────┐
│            Security Layer Architecture               │
├─────────────────────────────────────────────────────┤
│  Authentication:                                     │
│  - Supabase Auth (JWT tokens)                      │
│  - Email verification required                      │
│  - OAuth providers supported                        │
├─────────────────────────────────────────────────────┤
│  Authorization:                                      │
│  - Row Level Security (RLS) on all tables          │
│  - API route middleware validation                  │
│  - Socket.IO connection authentication              │
├─────────────────────────────────────────────────────┤
│  Input Validation:                                   │
│  - Zod schemas for all API inputs                  │
│  - File upload restrictions                         │
│  - SQL injection prevention                         │
├─────────────────────────────────────────────────────┤
│  Rate Limiting:                                      │
│  - API endpoint rate limits                         │
│  - User-based quotas                               │
│  - Cost control for AI services                     │
└─────────────────────────────────────────────────────┘
```

### Security Headers

```typescript
// Applied via Next.js middleware
const securityHeaders = {
  'Content-Security-Policy': "default-src 'self'",
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(self)'
};
```

---

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

---

## Scalability Considerations

### Horizontal Scaling

- **Stateless API Routes**: All API routes are stateless and can scale horizontally
- **Socket.IO Clustering**: Redis adapter for multi-instance Socket.IO
- **Database Connection Pooling**: Efficient connection management with Supabase
- **CDN Integration**: Static assets served via CDN

### Performance Optimizations

- **Caching Strategy**: React Query for client-side, Redis for server-side
- **Lazy Loading**: Code splitting and dynamic imports
- **Database Optimization**: Strategic indexes and query optimization
- **API Response Compression**: Gzip compression for all responses

### Cost Optimization

- **AI Service Management**: Request batching and caching for expensive operations
- **Audio Processing**: Client-side compression before upload
- **Vector Storage**: Efficient chunking strategies for embeddings
- **Monitoring**: Cost alerts and usage tracking

---

## Disaster Recovery

### Backup Strategy

- **Database**: Automated daily backups with 30-day retention
- **Audio Files**: Redundant storage with versioning
- **Configuration**: Infrastructure as Code with version control
- **Secrets**: Secure vault with rotation policies

### Recovery Procedures

1. **Service Degradation**: Fallback to cached responses
2. **Database Failure**: Automated failover to replica
3. **External Service Outage**: Circuit breakers and queuing
4. **Complete Outage**: Blue-green deployment for rapid recovery

---

## Future Architecture Considerations

### Planned Enhancements

1. **Mobile Optimization**: Native mobile app considerations
2. **Internationalization**: Multi-language support architecture
3. **Advanced Analytics**: Real-time analytics pipeline
4. **AI Model Flexibility**: Support for multiple AI providers

### Scalability Roadmap

1. **Microservices Migration**: Separate debate engine as standalone service
2. **Event-Driven Architecture**: Implement event sourcing for debate history
3. **Edge Computing**: Deploy AI inference at edge locations
4. **Federation**: Multi-region deployment with data sovereignty

---

This architecture documentation represents the current state of the DebateAI platform as of 2025-07. It should be updated as the system evolves and new architectural decisions are made.