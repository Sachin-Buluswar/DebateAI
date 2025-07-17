# DebateAI Frontend Architecture

## Next.js App Router Structure

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

## Component Architecture

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

## State Management

- **Server State**: React Query for API data caching
- **Client State**: React hooks for UI state
- **Real-time State**: Socket.IO event-driven updates
- **Form State**: React Hook Form with Zod validation

## Performance Optimizations

- Server Components by default
- Dynamic imports for heavy components
- Image optimization with Next.js Image
- Route prefetching and suspense boundaries

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

## Security Headers

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