# Development Environment Setup

This guide provides step-by-step instructions for setting up the DebateAI development environment.

## Prerequisites

- Node.js 18+ (recommended: use nvm for version management)
- npm 9+
- Git
- A Supabase account (for local development)
- API keys for required services

## Initial Setup

### 1. Clone the Repository

```bash
git clone [repository-url]
cd debatetest2
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Environment Configuration

Create your local environment file:

```bash
cp .env.example .env.local
```

Configure the following required environment variables:

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key
OPENAI_VECTOR_STORE_ID=your_vector_store_id

# ElevenLabs Configuration
ELEVENLABS_API_KEY=your_elevenlabs_api_key

# Optional: Debug and Monitoring
DEBUG_API_KEY=your_debug_api_key
SENTRY_DSN=your_sentry_dsn
```

### 4. Validate Environment

Run the environment validation script:

```bash
npm run check-env
```

This will verify that all required environment variables are set correctly.

## Database Setup

### 1. Apply Migrations

Run the migration scripts to set up your database schema:

```bash
npm run migrate
```

### 2. Verify Database

Check that all tables and policies are correctly set up:

```bash
node scripts/validate-database.js
```

### 3. Set Up Storage Buckets

Initialize Supabase storage buckets for audio and documents:

```bash
node scripts/fix-supabase-buckets.js
```

## Development Server

### Start the Development Server

```bash
npm run dev
```

The application will be available at `http://localhost:3001`

### Available Development Scripts

```bash
# Code Quality
npm run lint         # Run ESLint
npm run typecheck    # TypeScript validation
npm run format       # Format code with Prettier

# Testing
npm run test:manual  # Run manual test scripts
npm run test:socket  # Test Socket.IO connections

# Database
npm run migrate      # Apply database migrations
npm run check-db     # Validate database setup

# Build
npm run build        # Production build
npm run analyze      # Bundle size analysis
```

## Service Configuration

### OpenAI Setup

1. Create an OpenAI account and generate an API key
2. Create a vector store for wiki search functionality
3. Update your `.env.local` with the credentials

### ElevenLabs Setup

1. Create an ElevenLabs account
2. Generate an API key with voice synthesis permissions
3. Note the voice IDs you want to use (default voices are configured)

### Supabase Setup

1. Create a new Supabase project
2. Enable Email authentication
3. Set up Row Level Security (RLS) policies
4. Configure storage buckets for audio and documents

## Docker Development (Optional)

### Build Docker Image

```bash
npm run docker:build
```

### Run with Docker Compose

```bash
docker-compose up -d
```

## Troubleshooting Setup Issues

### Port Conflicts

If port 3001 is in use:

```bash
# Check what's using the port
lsof -i :3001

# Kill the process or change the port in package.json
```

### Database Connection Issues

1. Verify Supabase URL and keys are correct
2. Check if RLS policies are preventing access
3. Use the debug endpoint to test connectivity:

```bash
curl http://localhost:3001/api/debug -H "x-api-key: $DEBUG_API_KEY"
```

### Missing Dependencies

If you encounter module not found errors:

```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

## IDE Configuration

### VS Code Extensions

Recommended extensions for the best development experience:

- ESLint
- Prettier
- TypeScript and JavaScript Language Features
- Tailwind CSS IntelliSense
- Prisma (for database schema)

### Settings

Create `.vscode/settings.json`:

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "typescript.tsdk": "node_modules/typescript/lib"
}
```

## Next Steps

1. Review the [Git Workflow](./workflow.md) guide
2. Study the [Code Patterns](./patterns.md) documentation
3. Run through the [Testing Guide](./testing.md)
4. Check the [Troubleshooting](./troubleshooting.md) guide if you encounter issues

## Quick Health Check

After setup, verify everything is working:

```bash
# API health
curl http://localhost:3001/api/health

# Socket.IO test
npm run test:socket

# Database validation
node scripts/validate-database-simple.js
```

If all checks pass, you're ready to start developing!