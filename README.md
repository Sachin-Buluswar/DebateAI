# DebateAI

AI-powered debate platform with real-time debates, speech analysis, and evidence search. Built with Next.js 14, TypeScript, and production-ready infrastructure.

## 🚀 Current Status

**Version**: 1.0.0  
**Status**: Production-ready for desktop, mobile optimization in progress  
**Completion**: 95%  

### ✅ What's Working
- **All TypeScript errors fixed** - Project builds successfully
- **Standardized logging** - Consistent logger usage across codebase
- **Core features operational** - Real-time debates, speech analysis, evidence search
- **Production infrastructure** - Docker, CI/CD, monitoring, security hardening
- **Ready for Vercel deployment** - Optimized for serverless environments

### 🔧 Remaining Work
- Mobile responsiveness optimization (5%)
- Production environment configuration
- Load testing at scale

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
git clone https://github.com/yourusername/debateai.git
cd debateai

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
│   ├── api/               # API routes
│   ├── debate/            # Debate UI
│   ├── speech-feedback/   # Speech analysis
│   └── search/            # Evidence search
├── backend/
│   ├── modules/           # Business logic
│   └── services/          # External integrations
├── components/            # React components
└── lib/                   # Utilities & helpers
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
docker build -t debateai:latest .
docker run -p 3001:3001 debateai:latest
```

## 🚀 Deployment

### Vercel (Recommended)

1. Push to GitHub
2. Import project in Vercel
3. Configure environment variables
4. Deploy

### Docker

```bash
# Build production image
docker build -t debateai:prod .

# Run with environment variables
docker run -p 3001:3001 --env-file .env.local debateai:prod
```

### Manual Deployment

```bash
# Build application
npm run build

# Start production server
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
- JWT authentication for WebSocket connections
- Rate limiting on all API endpoints
- Input validation and sanitization
- CORS properly configured
- Security headers implemented

## 🎯 Features

### Real-time AI Debates
- 10 unique AI personalities
- WebSocket-based communication
- Live transcription and feedback
- Evidence search integration

### Speech Analysis
- AI-powered feedback
- Real-time transcription
- Performance metrics
- Improvement suggestions

### Evidence Search
- Vector-based semantic search
- RAG (Retrieval-Augmented Generation)
- Document management
- Context-aware results

### Production Infrastructure
- Docker containerization
- GitHub Actions CI/CD
- OpenTelemetry monitoring
- Sentry error tracking
- Automated testing

## 🐛 Known Issues

1. **Mobile Responsiveness** - Some components need mobile optimization
2. **Build Warning** - PDF test file reference in upload-document route (non-critical)
3. **Lint Warnings** - Some TypeScript 'any' types remain (non-blocking)

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