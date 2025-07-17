# Claude Development Guide for DebateAI

## 🎯 Project Overview

DebateAI is a production-ready AI debate platform that enables users to practice debating against AI opponents with distinct personalities. The application features real-time debates, speech analysis, and evidence search capabilities.

**Status**: 95% complete - Core features operational, production infrastructure ready, pending mobile optimization and final deployment configuration.

---

## 🏗️ Architecture & Technical Stack

### Core Technologies
- **Frontend**: Next.js 14.2.30 with TypeScript, Tailwind CSS
- **Backend**: Node.js with Socket.IO for real-time communication
- **Database**: Supabase (PostgreSQL) with Row Level Security
- **AI Services**: 
  - OpenAI GPT-4o-mini for debate speech and analysis
  - ElevenLabs for Text-to-Speech and Speech-to-Text
  - Vector embeddings for semantic search
- **Infrastructure**: Docker, GitHub Actions CI/CD, OpenTelemetry monitoring

### Key Features
1. **Real-time AI Debates**: 10 unique AI personalities with distinct debate styles
2. **Speech Feedback**: AI-powered analysis of user speeches with transcription
3. **Wiki Search**: Vector-based semantic search for evidence during debates
4. **Authentication**: Supabase Auth with email verification and OAuth support

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

## 🚀 Recent Improvements (2025-07)

### OpenAI API Architecture Refactor
- **Centralized Client Management**: Single connection pool via `OpenAIClientManager`
- **Standardized Error Handling**: Exponential backoff, circuit breakers, structured logging
- **Type Safety**: Comprehensive Zod schemas for all API interactions
- **Performance Monitoring**: Request tracking, cost estimation, latency metrics

### Enhanced UI Components (`ui-improvements` branch)
- `EnhancedButton`: Animated buttons with loading states
- `EnhancedInput`: Floating labels, validation feedback
- `Toast`: Non-intrusive notifications system
- Minimalist design system with consistent styling
- Enhanced debate stage visualization with progress indicators

### Production Infrastructure
- **Docker**: Multi-stage builds, ~150MB production image
- **CI/CD**: 9 GitHub Actions workflows (test, security, deploy)
- **Monitoring**: OpenTelemetry, Sentry, Grafana dashboards
- **Health Checks**: Comprehensive endpoint monitoring

---

## 🔧 Development Setup

### Environment Configuration
```bash
# Install dependencies
npm install

# Configure environment
cp .env.example .env.local

# Required variables:
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
OPENAI_API_KEY=
ELEVENLABS_API_KEY=
OPENAI_VECTOR_STORE_ID=

# Start development
npm run dev  # http://localhost:3001
```

### Available Scripts
```bash
npm run dev          # Development server
npm run build        # Production build
npm run lint         # ESLint check
npm run typecheck    # TypeScript validation
npm run check-env    # Validate environment
npm run test:manual  # Manual testing scripts
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

## 📊 Current Status

### Completed Features (95%)
✅ **Core Functionality**
- Real-time AI debates with 10 personalities
- Speech analysis with transcription
- Wiki search with vector embeddings
- Authentication with Supabase

✅ **Recent Improvements**
- OpenAI API centralization and optimization
- Enhanced UI components (ui-improvements branch)
- Docker containerization
- CI/CD pipeline with GitHub Actions
- Production monitoring setup

### Remaining Work (5%)
🚧 **Mobile Optimization**
- Responsive layouts for debate interface
- Touch-optimized controls
- Mobile audio handling

🚧 **Final Production Steps**
- Deploy configuration
- Load testing
- Security audit

---

## 🎯 Key Principles

1. **User Approval Required**: Never merge to main without explicit user approval
2. **Test Everything**: Run lint, typecheck, and manual tests before committing
3. **Follow Patterns**: Use existing code patterns and structures
4. **Error Recovery**: All external APIs must have retry logic
5. **Security First**: Validate inputs, use RLS, implement rate limiting

---

## 📚 Documentation

### Core References
- `docs/OPENAI_API_IMPROVEMENTS.md` - Recent API architecture changes
- `docs/architecture.md` - System design overview
- `docs/CI_CD_SETUP.md` - Deployment pipeline
- `instructions/requirements.md` - Feature specifications

### Quick Links
- [Production Deployment](docs/DEPLOYMENT_PROCESS.md)
- [Monitoring Guide](docs/MONITORING_GUIDE.md)
- [Troubleshooting](TROUBLESHOOTING.md)

---

**Remember**: This is a production application with real users. Always prioritize stability, security, and user experience in all changes.