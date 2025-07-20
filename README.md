# DebateAI

AI debate platform. Next.js application with real-time debates, speech analysis, and evidence search.

## Project Structure

```
src/app/              # Next.js 13+ App Router pages
src/backend/          # Business logic and services  
src/components/       # React components
src/lib/             # Utilities and helpers
```

## Setup Instructions

### Required Environment Variables

Create `.env.local` with:

```bash
NEXT_PUBLIC_SUPABASE_URL=<supabase_project_url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<supabase_anon_key>
SUPABASE_SERVICE_ROLE_KEY=<supabase_service_role_key>
OPENAI_API_KEY=<openai_api_key>
ELEVENLABS_API_KEY=<elevenlabs_api_key>
OPENAI_VECTOR_STORE_ID=<vector_store_id>
```

### Installation Commands

```bash
npm install
cp .env.example .env.local
# Add API keys to .env.local
npm run dev
```

Server runs on `http://localhost:3001`

## Key Files

- `src/app/api/` - REST API endpoints
- `src/pages/api/socketio.ts` - WebSocket server
- `src/backend/services/` - External service integrations
- `src/lib/supabase/` - Database client and types
- `supabase/migrations/` - Database schema

## Development Commands

```bash
npm run dev          # Start development server
npm run build        # Production build
npm run lint         # Run ESLint
npm run typecheck    # TypeScript validation
```

## API Endpoints

### Authentication
- `POST /api/auth/signup` - Create account
- `POST /api/auth/signin` - Sign in
- `POST /api/auth/signout` - Sign out
- `GET /api/auth/callback` - OAuth callback

### Debate
- `POST /api/generate-debate-speech` - Generate AI speech
- `POST /api/start-debate` - Initialize debate session
- `WebSocket /api/socketio` - Real-time debate communication

### Speech Analysis
- `POST /api/feedback/upload` - Upload audio for analysis (chunked)
- `POST /api/feedback` - Get speech feedback

### Search
- `POST /api/wiki-search` - AI Assistant search (true RAG)
- `POST /api/wiki-document-search` - Direct document search with context

## Documentation

- `docs/getting-started/` - Setup and configuration
- `docs/architecture/` - System design
- `docs/development/` - Development guides
- `docs/deployment/` - Production deployment
- `docs/api/` - API reference

## Current Status

- Version: 1.0-beta
- Completion: 95%
- Remaining: Mobile optimization

See `docs/project/status.md` for details.

## Critical Issues Before Deployment

See `docs/deployment/blockers.md`:
- Fix CORS origin in `src/pages/api/socketio.ts`
- Add viewport meta tag in `src/app/layout.tsx`
- Secure debug endpoints
- Configure GitHub secrets