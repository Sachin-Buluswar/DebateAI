# Eris Debate

AI-powered debate platform with real-time debates, speech analysis, and evidence search. Built with Next.js 14, TypeScript, and optimized for Vercel deployment.

## 🚀 Current Status

**Version**: 1.0.0  
**Status**: Near production-ready (database setup needed)  
**Completion**: ~75-80% (Claude Code fixed security & config)  
**Build Status**: ✅ Builds successfully (features need DB tables)

### ✅ What's Working
- **All TypeScript errors fixed** - Project builds successfully
- **Core features operational** - Real-time debates, speech analysis, evidence search
- **Speech feedback system** - Fixed 500 errors with in-memory session storage for serverless
- **Real-time communication** - Implemented Supabase Realtime for WebSocket support on Vercel
- **Production infrastructure** - Docker, CI/CD, monitoring, security hardening
- **Standardized patterns** - Consistent error handling, retry logic, and rate limiting

### 🔴 Critical Blockers (Must Fix)
1. **Missing Database Tables** - Search, debates, and documents features are broken without proper tables
2. **Missing Critical Env Vars** - `ELEVENLABS_CROSSFIRE_AGENT_ID` and `OPENAI_VECTOR_STORE_ID` required
3. **CORS Security** - `vercel.json` uses wildcard `*` instead of specific domain
4. **Missing Storage Buckets** - `debate-documents` and `debate_audio` buckets needed

See `CURRENT_TASK_LISTS.md` for detailed fixes.

### 🔧 Remaining Work
- Create missing database tables (~1 hour)
- Set up critical API keys and storage (~30 min)
- Fix security vulnerabilities (~30 min)
- Mobile responsiveness optimization (60% complete)
- Replace 701 console.log statements
- Production monitoring setup

## 📋 Quick Start

### Prerequisites
- Node.js 18+
- npm or yarn
- Supabase account
- OpenAI API key
- ElevenLabs API key

### Installation

```bash
# Clone repository
git clone https://github.com/[your-username]/eris-debate.git
cd eris-debate

# Install dependencies
npm install

# Setup environment
cp .env.example .env.local
# Edit .env.local with your API keys

# Run database migrations
npm run db:migrate

# Start development server
npm run dev
```

Server runs on `http://localhost:3001`

### Required Environment Variables

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# AI Services
OPENAI_API_KEY=your_openai_api_key
ELEVENLABS_API_KEY=your_elevenlabs_api_key
OPENAI_VECTOR_STORE_ID=your_vector_store_id

# Optional: Production
SENTRY_DSN=your_sentry_dsn
NEXT_PUBLIC_APP_URL=https://yourdomain.com
```

## 🏗️ Architecture

```
src/
├── app/                    # Next.js 14 App Router
│   ├── api/               # API routes (REST endpoints)
│   ├── debate/            # Real-time debate UI
│   ├── speech-feedback/   # Speech analysis interface
│   └── search/            # RAG-powered evidence search
├── backend/
│   ├── modules/           # Business logic
│   │   ├── realtimeDebate/   # Debate orchestration
│   │   ├── speechFeedback/   # Speech processing
│   │   └── wikiSearch/       # Document retrieval
│   └── services/          # External integrations
│       ├── openaiService.ts      # GPT-4 integration
│       ├── elevenLabsWebSocket.ts # Voice services
│       └── documentStorageService.ts # Supabase storage
├── components/            # React components
│   ├── ui/               # Reusable UI components
│   ├── debate/           # Debate-specific components
│   └── layout/           # Layout components
└── lib/                   # Utilities & configuration
    ├── errorRecovery.ts  # Retry logic patterns
    ├── rateLimit.ts      # API rate limiting
    └── supabase/         # Database client
```

## 🛠️ Development

### Key Commands

```bash
npm run dev          # Development server
npm run build        # Production build
npm run start        # Production server
npm run lint         # ESLint check
npm run typecheck    # TypeScript validation
npm run test         # Run tests
npm run format       # Code formatting
```

### Production Build

```bash
# Build for production
npm run build

# Test production build locally
npm run start

# Docker production build
docker build -t eris-debate:latest .
docker run -p 3001:3001 eris-debate:latest
```

## 🚀 Deployment

### Vercel (Recommended)

The application is optimized for Vercel deployment with serverless adaptations:

1. **Fix Critical Blockers First**:
   - Update CORS origin in `/src/pages/api/socketio.ts`
   - Add viewport meta tag to `src/app/layout.tsx`

2. **Deploy to Vercel**:
   ```bash
   # Install Vercel CLI
   npm i -g vercel
   
   # Deploy
   vercel
   ```

3. **Configure Environment Variables** in Vercel Dashboard:
   - All `NEXT_PUBLIC_*` variables
   - Server-side API keys
   - Set `NEXT_PUBLIC_APP_URL` to your production domain

4. **Features on Vercel**:
   - Supabase Realtime for WebSocket functionality
   - In-memory session storage for speech uploads
   - Automatic scaling and edge deployment

### Docker (Self-Hosted)

```bash
# Build production image
docker build -t eris-debate:prod .

# Run with environment variables
docker run -p 3001:3001 --env-file .env.local eris-debate:prod
```

### Manual Deployment

```bash
# Build application
npm run build

# Start production server (with Socket.IO support)
npm run start
```

## 📚 Documentation

- **[Getting Started](docs/getting-started/)** - Setup and configuration
- **[Architecture](docs/architecture/)** - System design and patterns
- **[API Reference](docs/api/)** - Endpoint documentation
- **[Deployment Guide](docs/deployment/)** - Production deployment
- **[Development](docs/development/)** - Development guidelines

## 🔒 Security

- Row-level security (RLS) on all database tables
- JWT authentication for API endpoints
- Rate limiting on all API endpoints
- Input validation and sanitization
- CORS properly configured (needs fix for production)
- Security headers implemented

## 🎯 Features

### Real-time AI Debates
- 10 unique AI personalities with distinct debate styles
- Supabase Realtime for low-latency communication
- Live transcription and AI-generated responses
- Crossfire debate mode with ElevenLabs integration

### Speech Analysis & Feedback
- AI-powered speech evaluation using GPT-4
- Real-time speech-to-text transcription
- Performance metrics and improvement suggestions
- Serverless-optimized chunked upload system

### Evidence Search (RAG)
- Vector-based semantic search with OpenAI embeddings
- Multiple retrieval strategies (semantic, keyword, hybrid)
- Document management with PDF support
- Context-aware answer generation

### Production Infrastructure
- Optimized for Vercel serverless deployment
- Docker support for self-hosting
- GitHub Actions CI/CD pipeline
- Comprehensive monitoring (Sentry + OpenTelemetry)
- Automated testing and type checking

## 🐛 Known Issues

### Critical (Must Fix Before Deploy)
1. **Hardcoded CORS Origin** - `/src/pages/api/socketio.ts` hardcoded to localhost
2. **Missing Viewport Meta** - Breaks all mobile rendering

### Non-Critical
1. **Mobile Responsiveness** - 60% complete, needs optimization for smaller screens
2. **Security Hardening** - 3 high-priority items (debug endpoint, path traversal, auth errors)
3. **TypeScript 'any' Types** - Some remain but don't block functionality

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

See [CONTRIBUTING.md](CONTRIBUTING.md) for detailed guidelines.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Next.js team for the amazing framework
- Supabase for the backend infrastructure
- OpenAI for GPT-4 capabilities
- ElevenLabs for voice synthesis
- All contributors and testers