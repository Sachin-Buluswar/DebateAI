# AI Agent Instructions for DebateAI

## Critical Rules

1. NEVER merge to main branch without explicit user approval
2. NEVER commit directly to main branch
3. ALWAYS create feature branches for changes
4. ALWAYS run `npm run lint` and `npm run typecheck` before committing
5. NEVER expose API keys in client-side code
6. ALWAYS use existing patterns - do not create new patterns

## Project Information

- Type: Next.js 14 application
- Language: TypeScript
- Database: Supabase (PostgreSQL with RLS)
- Real-time: Socket.IO
- AI: OpenAI GPT-4, ElevenLabs TTS/STT

## File Structure

```
src/
├── app/                    # Next.js App Router
│   ├── api/               # API routes (route.ts files)
│   ├── (auth)/            # Auth pages
│   ├── debate/            # Debate UI
│   ├── speech-feedback/   # Speech analysis UI
│   └── search/            # Search UI
├── backend/
│   ├── modules/           # Business logic
│   │   └── realtimeDebate/
│   └── services/          # External integrations
│       ├── openaiService.ts
│       ├── elevenLabsService.ts
│       └── supabaseService.ts
├── components/
│   ├── ui/                # Reusable UI components
│   ├── debate/            # Debate-specific components
│   └── layout/            # Layout components
└── lib/
    ├── errorRecovery.ts   # Retry logic patterns
    └── rateLimit.ts       # Rate limiting
```

## Required Patterns

### API Route Pattern

File: `src/app/api/[endpoint]/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { withRateLimit } from '@/lib/rateLimit';
import { z } from 'zod';

const requestSchema = z.object({
  // Define schema
});

export async function POST(request: NextRequest) {
  // 1. Rate limit
  const rateLimitResult = await withRateLimit(request);
  if (!rateLimitResult.success) return rateLimitResult.response;

  // 2. Parse and validate
  try {
    const body = await request.json();
    const validated = requestSchema.parse(body);
  } catch (error) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  // 3. Execute with error handling
  try {
    // Business logic
    return NextResponse.json({ data: result });
  } catch (error) {
    console.error(`API Error [${request.url}]:`, error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
```

### Component Pattern

```typescript
'use client'; // Only if using hooks/state/browser APIs

interface ComponentProps {
  // Define props
}

export function Component({ props }: ComponentProps) {
  // For async operations, always include loading and error states
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Error must be user-friendly
  const handleAction = async () => {
    try {
      setLoading(true);
      setError(null);
      // Action
    } catch (err) {
      setError('Failed to perform action. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return <div>{/* Content */}</div>;
}
```

### Service Pattern with Retry

```typescript
import { withRetry } from '@/lib/errorRecovery';

class ServiceName {
  async methodName(params: ParamType): Promise<ReturnType> {
    return withRetry(
      async () => {
        // Validate inputs
        const validated = schema.parse(params);
        
        // Make request
        const response = await fetch(...);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        return response.json();
      },
      { 
        maxRetries: 3,
        backoffMs: 1000,
        backoffMultiplier: 2
      }
    );
  }
}
```

## Environment Variables

Required in `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
OPENAI_API_KEY=
ELEVENLABS_API_KEY=
OPENAI_VECTOR_STORE_ID=
```

## Git Workflow

```bash
# Create feature branch
git checkout -b feature/description

# Make changes
# Run checks
npm run lint
npm run typecheck

# Commit with descriptive message
git add .
git commit -m "feat: add specific feature

- Detail 1
- Detail 2"

# Push branch
git push origin feature/description

# DO NOT MERGE - User will handle merging
```

## Common File Locations

- API routes: `src/app/api/*/route.ts`
- Page components: `src/app/*/page.tsx`
- Shared components: `src/components/`
- Database types: `src/lib/supabase/types.ts`
- Service integrations: `src/backend/services/`
- Utilities: `src/lib/`

## Testing Requirements

Before marking any task complete:

1. Code compiles: `npm run build`
2. No lint errors: `npm run lint`
3. No type errors: `npm run typecheck`
4. Feature works in browser
5. No console errors in browser
6. Works on mobile viewport (375px width)

## Error Messages

When errors occur, check:

1. Browser console for client errors
2. Terminal for server errors
3. Network tab for API failures
4. Supabase dashboard for database errors

## Current Issues

See `docs/deployment/blockers.md` for critical issues that must be fixed.

## Do Not

1. Create new files unless necessary - prefer editing existing files
2. Add console.log statements - use existing logging
3. Change established patterns
4. Install new dependencies without approval
5. Modify database schema without migrations
6. Expose sensitive data in responses
7. Skip error handling
8. Ignore TypeScript errors