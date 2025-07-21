# Documentation Index

## Setup and Configuration

- `docs/getting-started/installation.md` - System requirements, prerequisites, installation steps
- `docs/getting-started/configuration.md` - Environment variables, API keys, email templates
- `docs/getting-started/quick-start.md` - First run instructions, creating account, running first debate

## Architecture

- `docs/architecture/overview.md` - System components, technology stack, design principles
- `docs/architecture/frontend.md` - Next.js structure, components, state management
- `docs/architecture/backend.md` - API design, service layer, error handling
- `docs/architecture/database.md` - Supabase schema, RLS policies, migrations
- `docs/architecture/enhanced-rag.md` - PDF storage, vector search, RAG implementation
- `docs/architecture/openai-improvements.md` - OpenAI client architecture, retry logic
- `docs/architecture/techstack.md` - Complete technology list with versions
- `docs/architecture/ui-ux-system-design.md` - Design system, component patterns

## Development

- `docs/development/setup.md` - Local development environment setup
- `docs/development/workflow.md` - Git branching, commit messages, PR process
- `docs/development/patterns.md` - Code patterns for APIs, components, services
- `docs/development/testing.md` - Testing requirements, manual test procedures
- `docs/development/troubleshooting.md` - Common errors and solutions
- `docs/development/integration-testing.md` - Integration test procedures
- `docs/development/performance-baseline.md` - Performance metrics and benchmarks

## API Reference

- `docs/api/rest.md` - All REST endpoints with request/response formats
- `docs/api/websocket.md` - Socket.IO events and message formats
- `docs/api/integrations/openai.md` - OpenAI API integration details
- `docs/api/integrations/elevenlabs.md` - ElevenLabs TTS/STT integration
- `docs/api/integrations/elevenlabs-websocket.md` - ElevenLabs WebSocket API
- `docs/api/integrations/supabase.md` - Supabase client usage

## Deployment

- `docs/deployment/blockers.md` - Critical issues that must be fixed before deployment
- `docs/deployment/checklist.md` - Pre-deployment verification steps
- `docs/deployment/docker.md` - Docker setup and configuration
- `docs/deployment/ci-cd.md` - GitHub Actions workflows
- `docs/deployment/monitoring.md` - OpenTelemetry and Sentry setup
- `docs/deployment/security.md` - Security audit findings and fixes
- `docs/deployment/environment-secrets.md` - Secret management
- `docs/deployment/deployment-process.md` - Step-by-step deployment guide
- `docs/deployment/email-setup.md` - Email template configuration
- `docs/deployment/alert-response.md` - Alert handling procedures

## Project Management

- `docs/project/status.md` - Current project status and completion percentage
- `docs/project/roadmap.md` - UI improvements and feature roadmap
- `docs/project/requirements.md` - Original project requirements

## File Paths

### API Routes
- `src/app/api/auth/` - Authentication endpoints
- `src/app/api/debate/` - Debate-related endpoints
- `src/app/api/feedback/` - Speech feedback endpoints
- `src/app/api/wiki-search/` - Search endpoints
- `src/pages/api/socketio.ts` - WebSocket server

### Services
- `src/backend/services/openaiService.ts` - OpenAI integration
- `src/backend/services/elevenLabsService.ts` - Voice services
- `src/backend/services/supabaseService.ts` - Database operations

### Components
- `src/components/ui/` - Reusable UI components
- `src/components/debate/` - Debate-specific components
- `src/components/layout/` - Layout components

### Configuration
- `.env.local` - Environment variables
- `next.config.js` - Next.js configuration
- `tailwind.config.js` - Tailwind CSS configuration
- `tsconfig.json` - TypeScript configuration

## Database

### Tables
- `profiles` - User profiles
- `debate_sessions` - Debate session records
- `debate_speeches` - Individual speeches in debates
- `speech_feedback` - Analysis results
- `saved_searches` - User's saved searches
- `audio_recordings` - Audio file metadata

### Migrations
- `supabase/migrations/` - All database migrations

## Current Status

**TypeScript Compilation**: ✅ All errors fixed, project builds successfully  
**Logger Implementation**: ✅ Standardized across entire codebase  
**Production Readiness**: 98% complete

## Remaining Issues

1. CORS origin hardcoded in `src/pages/api/socketio.ts:30`
2. Missing viewport meta tag in `src/app/layout.tsx`
3. Debug endpoint exposed in production
4. Path traversal risk in file uploads
5. Information leakage in auth errors

See `docs/deployment/blockers.md` for complete list and fixes.