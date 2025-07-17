# DebateAI Backend Architecture

## Service Layer Architecture

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

## API Route Pattern

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

## Service Integration Pattern

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