# Claude Development Guide for DebateAI

This guide provides development guidelines, code patterns, and workflow instructions for AI assistants and contributors working on DebateAI.

**Important**: This is a production application. Always prioritize stability, security, and user experience. Never merge to main without explicit user approval.

---

## 📁 Project Structure

```
src/
├── app/                    # Next.js 13+ App Router
│   ├── api/               # REST API endpoints
│   ├── (auth)/            # Authentication pages
│   ├── debate/            # Real-time debate UI
│   ├── speech-feedback/   # Speech analysis interface
│   └── search/            # Wiki search interface
├── backend/
│   ├── modules/           # Core business logic
│   │   └── realtimeDebate/   # Debate orchestration
│   └── services/          # External integrations
│       ├── openaiService.ts       # Centralized OpenAI client
│       ├── elevenLabsService.ts   # TTS/STT service
│       └── supabaseService.ts     # Database operations
├── components/
│   ├── ui/                # Enhanced UI components
│   ├── debate/            # Debate-specific components
│   └── layout/            # App layout components
└── lib/                   # Utilities and helpers
    ├── errorRecovery.ts   # Retry logic & error handling
    └── rateLimit.ts       # API rate limiting

```

## 🚀 Key Development Areas

### 1. Enhanced RAG System
- PDF documents stored in Supabase Storage with direct viewing
- Three search modes: Assistant (AI-enhanced), RAG (raw chunks), Enhanced RAG (with PDF context)
- OpenCaseList integration for debate evidence
- Admin dashboard at `/admin/documents` for document management

### 2. OpenAI API Architecture
- Centralized client management via `OpenAIClientManager`
- Exponential backoff and circuit breakers for reliability
- Comprehensive Zod schemas for type safety
- Request tracking and cost estimation

### 3. UI Components
- Enhanced components with loading states and animations
- Minimalist design system with consistent styling
- Toast notifications for user feedback
- Progressive enhancement for accessibility

### 4. Production Infrastructure
- Docker multi-stage builds (~150MB production image)
- 9 GitHub Actions workflows for CI/CD
- OpenTelemetry and Sentry monitoring
- Comprehensive health checks

---

## 🔧 Development Workflow

### Before Starting
1. Read the [README.md](README.md) for project overview
2. Review [PRODUCTION_STATUS.md](docs/project/status.md) for current state
3. Check [UI_IMPROVEMENTS_ROADMAP.md](docs/project/roadmap.md) for remaining work
4. Understand the [architecture](docs/architecture/overview.md)

### Local Development
```bash
# Setup
npm install
cp .env.example .env.local
npm run check-env

# Development
npm run dev          # Start dev server (http://localhost:3001)
npm run lint         # Check code style
npm run typecheck    # Validate TypeScript

# Testing
npm run test:manual  # Manual test scripts
npm run test:socket  # Socket.IO connection test
```

---

## 🌿 Git Workflow

### Branch Strategy
- `main` - Production-ready code
- `ui-improvements` - Active UI/UX enhancements (current)
- `feature/*` - New feature development
- `fix/*` - Bug fixes

### Development Process
1. **Always create a feature branch** - Never commit directly to main
2. **Test thoroughly** - Run lint, typecheck, and manual tests
3. **User approval required** - All changes need explicit approval before merging
4. **Use descriptive commits** - Clear, actionable commit messages

### Merging Protocol
```bash
# IMPORTANT: Claude should NEVER merge without user approval

# For user to test changes:
git checkout [branch-name]
npm run dev

# For user to approve:
git checkout main
git merge [branch-name]
```

## 💻 Code Patterns & Best Practices

### API Route Pattern
```typescript
// src/app/api/[endpoint]/route.ts
import { withRateLimit } from '@/lib/rateLimit';
import { validateRequest } from '@/lib/validation';

export async function POST(request: Request) {
  // 1. Rate limiting
  const { success, response } = await withRateLimit(request);
  if (!success) return response;

  // 2. Validation with Zod
  const { data, error } = await validateRequest(request, schema);
  if (error) return NextResponse.json({ error }, { status: 400 });

  // 3. Business logic with error recovery
  try {
    const result = await serviceCall(data);
    return NextResponse.json(result);
  } catch (error) {
    logger.error('API Error', { error, endpoint: '/api/[endpoint]' });
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    );
  }
}
```

### Component Pattern
```typescript
// Use server components by default, client components only when needed
'use client'; // Only if using hooks, state, or browser APIs

export function Component() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Error handling with user-friendly messages
  const handleAction = async () => {
    try {
      setLoading(true);
      await apiCall();
    } catch (err) {
      setError(getUserFriendlyError(err));
    } finally {
      setLoading(false);
    }
  };

  // Always show loading and error states
  if (loading) return <Spinner />;
  if (error) return <ErrorMessage error={error} onRetry={handleAction} />;

  return <div>{/* Component content */}</div>;
}
```

### Service Integration Pattern
```typescript
// Centralized service with retry logic
class OpenAIService {
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

## 🧪 Testing & Debugging

### Health Checks
```bash
# API health
curl http://localhost:3001/api/health

# Debug endpoint (requires DEBUG_API_KEY)
curl http://localhost:3001/api/debug \
  -H "x-api-key: $DEBUG_API_KEY"

# Socket.IO connection test
npm run test:socket
```

### Common Issues
1. **WebSocket Connection**: Check JWT token and Socket.IO initialization
2. **API Rate Limiting**: Monitor rate limit headers in responses
3. **Audio Processing**: Verify ElevenLabs API key and model IDs
4. **Database**: Check Supabase RLS policies and connection pool

### Debugging Tools
- Browser DevTools for client-side issues
- Structured logs with request IDs for tracing
- Supabase dashboard for database queries
- OpenTelemetry traces for performance

---

## 🚨 Critical Guidelines

### Security
- **Never expose API keys** in client-side code
- **Always validate input** with Zod schemas
- **Use RLS policies** for all user data access
- **Implement rate limiting** on all endpoints

### Performance
- **Lazy load** heavy components
- **Optimize images** with Next.js Image
- **Use server components** where possible
- **Cache API responses** appropriately

### Error Handling
- **Always catch errors** in async operations
- **Provide fallback UI** for error states
- **Log errors** with context for debugging
- **Implement retry logic** for transient failures

## 📊 Development Status

### What's Working
- ✅ All core features operational
- ✅ Production infrastructure ready
- ✅ Enhanced RAG system with PDF support
- ✅ CI/CD and monitoring configured

### What Needs Work
- 🚧 Mobile optimization (see [UI_IMPROVEMENTS_ROADMAP.md](docs/project/roadmap.md))
- 🚧 Final deployment configuration
- 🚧 Load testing and security audit

### Active Development
- Current focus: Mobile responsiveness
- Next priority: Production deployment
- See [PRODUCTION_STATUS.md](docs/project/status.md) for details

---

## 🎯 Key Principles

1. **User Approval Required**: Never merge to main without explicit user approval
2. **Test Everything**: Run lint, typecheck, and manual tests before committing
3. **Follow Patterns**: Use existing code patterns and structures
4. **Error Recovery**: All external APIs must have retry logic
5. **Security First**: Validate inputs, use RLS, implement rate limiting

---

## 📚 Key Documentation

### Architecture & Design
- [System Architecture](docs/architecture/overview.md) - Component design and interactions
- [Enhanced RAG Architecture](docs/architecture/rag-system.md) - PDF search system
- [OpenAI API Improvements](docs/architecture/openai-integration.md) - API architecture

### Operations & Deployment
- [CI/CD Setup](docs/deployment/ci-cd.md) - GitHub Actions workflows
- [Deployment Process](docs/deployment/production.md) - Production deployment
- [Monitoring Guide](docs/deployment/monitoring.md) - Observability setup

### API References
- [Supabase API](docs/api/supabase.md) - Database and auth
- [OpenAI API](docs/api/openai.md) - AI services
- [ElevenLabs API](docs/api/elevenlabs.md) - Voice services
- [Socket.IO API](docs/api/socketio.md) - Real-time communication

### Development Resources
- [Troubleshooting](docs/development/troubleshooting.md) - Common issues and solutions
- [Environment Secrets](docs/development/environment.md) - Configuration guide
- [Performance Baseline](docs/performance/baseline.md) - Benchmarks

---

## 🤖 AI Assistant Guidelines

When working on this codebase:

1. **Never merge without approval** - Always create feature branches
2. **Test everything** - Run lint, typecheck, and manual tests
3. **Follow existing patterns** - Consistency is key
4. **Document changes** - Update relevant documentation
5. **Consider mobile** - All UI changes must work on mobile
6. **Handle errors gracefully** - Implement retry logic for external APIs
7. **Secure by default** - Validate inputs, use RLS, rate limit endpoints
8. **Note necessary human action** - Give the human a list of ALL the tasks they must do to complete the changes

Remember: This is a production application with real users. Quality matters.