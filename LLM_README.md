# 🤖 LLM Agent Quick Reference - Eris Debate

> **This document is optimized for LLM/AI agents. For detailed instructions, see CLAUDE.md**

## Critical Rules

```yaml
NEVER:
  - Use service role keys in API routes
  - Skip authentication checks
  - Use alert() for notifications
  - Create new patterns
  - Use 'any' TypeScript type
  - Commit to main branch
  - Add console.log statements
  
ALWAYS:
  - Use centralized auth middleware
  - Validate inputs with Zod
  - Use toast notifications
  - Follow existing patterns
  - Test at 375px width
  - Run lint and typecheck
  - Create feature branches
```

## File Locations Quick Reference

```yaml
API_Routes: src/app/api/*/route.ts
Pages: src/app/*/page.tsx
Components: src/components/
Business_Logic: src/backend/modules/
Services: src/backend/services/
Auth_Middleware: src/lib/auth-middleware.ts
Types: src/types/
Types: src/types/
```

## Required Imports by Context

### API Route
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireAdmin, optionalAuth } from '@/lib/auth-middleware';
import { withRateLimit, apiRateLimiter } from '@/api-middleware/rateLimiter';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';
```

### Client Component
```typescript
'use client';
import { useState, useEffect } from 'react';
import { useToast } from '@/lib/toast';
import Button from '@/components/ui/Button';
import { FormField } from '@/components/ui/FormField';
```

### Server Component
```typescript
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
```

## Pattern Templates

### Authenticated API Endpoint
```typescript
export async function POST(request: NextRequest) {
  return await withRateLimit(request, apiRateLimiter, async () => {
    return requireAuth(request, async (authenticatedRequest) => {
      const user = authenticatedRequest.user;
      const schema = z.object({ /* schema */ });
      
      try {
        const body = await request.json();
        const validated = schema.parse(body);
        const supabase = createClient();
        
        // Business logic
        
        return NextResponse.json({ success: true, data: result });
      } catch (error) {
        if (error instanceof z.ZodError) {
          return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
        }
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
      }
    });
  });
}
```

### Form with Validation
```typescript
const [formData, setFormData] = useState({ field: '' });
const [formErrors, setFormErrors] = useState<Record<string, string>>({});
const [submitting, setSubmitting] = useState(false);
const toast = useToast();

const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  // Validate
  // Submit
  // Handle errors with toast
};
```

## Database Tables

```yaml
Auth:
  - users (Supabase Auth managed)
  - user_roles (admin/user)
  - user_preferences
  
Debates:
  - debates
  - rounds
  - speeches
  - speech_recordings
  
Documents:
  - documents
  - document_chunks
  
Feedback:
  - feedback_submissions
  - speech_feedback_results
```

## Environment Variables

```yaml
Required:
  Supabase:
    - NEXT_PUBLIC_SUPABASE_URL
    - NEXT_PUBLIC_SUPABASE_ANON_KEY
    - SUPABASE_SERVICE_ROLE_KEY # Server only!
  
  AI:
    - OPENAI_API_KEY
    - ELEVENLABS_API_KEY
    - OPENAI_VECTOR_STORE_ID
    - ELEVENLABS_CROSSFIRE_AGENT_ID

Production_Only:
  - NEXT_PUBLIC_SITE_URL
  - ALLOWED_ORIGINS
  - SENTRY_DSN
```

## Common Tasks

### Add New API Endpoint
1. Create: `src/app/api/[name]/route.ts`
2. Use auth middleware pattern
3. Add rate limiting
4. Validate with Zod
5. Test with: `curl http://localhost:3001/api/[name]`

### Add New Page
1. Create: `src/app/[name]/page.tsx`
2. For authenticated: place in `(authenticated)` folder
3. Use existing layout
4. Test mobile view

### Update Database Schema
1. Create migration in Supabase dashboard
2. Update types: `src/lib/supabase/types.ts`
3. Add RLS policies
4. Test locally first

### Handle File Upload
```typescript
// Use existing upload session store
import { uploadSessionStore } from '@/lib/uploadSessionStore';

// For chunks
const sessionId = crypto.randomUUID();
uploadSessionStore.set(sessionId, { chunks: [], metadata });
```

## Testing Checklist

```bash
# Before marking complete
npm run lint          # No errors
npm run typecheck     # No type errors
npm run build         # Builds successfully

# Test in browser
- [ ] Feature works
- [ ] No console errors
- [ ] Mobile view (375px)
- [ ] Error cases handled
- [ ] Toast notifications work
```

## Error Handling

```typescript
// API Routes
try {
  // code
} catch (_error) {
  return NextResponse.json(
    { error: 'User-friendly message' },
    { status: 500 }
  );
}

// Client Components
try {
  // code
} catch (error) {
  toast.error('User-friendly message');
}
```

## Security Checklist

- [ ] No service role key in client code
- [ ] Authentication check on route
- [ ] Input validation with Zod
- [ ] Rate limiting applied
- [ ] RLS policies respected
- [ ] No sensitive data in response
- [ ] Generic error messages

## Quick Debugging

```yaml
Auth_Issues:
  - Check: supabase.auth.getUser()
  - Verify: RLS policies in Supabase
  - Check: /src/middleware/auth.ts

Build_Errors:
  - Run: rm -rf .next && npm run build
  - Check: npm run typecheck
  - Clear: rm -rf node_modules && npm install

API_Errors:
  - Check: Network tab in browser
  - Check: Server logs in terminal
  - Verify: Environment variables
  - Test: Rate limiting

WebSocket_Issues:
  - Check: CORS configuration
  - Verify: NEXT_PUBLIC_USE_SUPABASE_REALTIME flag
  - Check: Supabase Realtime status
```

## Git Workflow

```bash
# Always
git checkout -b feature/description
# Make changes
npm run lint && npm run typecheck
git add . && git commit -m "feat: description"
git push origin feature/description
# Never merge - user handles
```

## Performance Tips

```yaml
Optimize:
  - Use dynamic imports for large components
  - Implement React.memo for expensive renders
  - Use Image component with optimization
  - Batch database queries
  - Cache frequently accessed data

Avoid:
  - Large bundles in initial load
  - Synchronous operations in API routes
  - Multiple database round trips
  - Unoptimized images
  - Memory leaks in effects
```

## Contact Points

- **Main Instructions**: `/CLAUDE.md`
- **Project Status**: `/STATUS.md`
- **API Docs**: `/API_DOCUMENTATION.md`
- **Architecture**: `/docs/architecture/`

## Final Reminders

1. **Production is LIVE** - Be careful with changes
2. **Follow patterns** - Don't innovate unnecessarily
3. **Test thoroughly** - Including mobile views
4. **Security first** - Never compromise on auth
5. **User experience** - Professional, no alerts
6. **Ask if unsure** - Better safe than sorry