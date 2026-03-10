# AI Agent Instructions for Eris Debate

## 🚨 CRITICAL: Security-First Development

You are working on a **production-ready debate platform** with strict security requirements. Every change must maintain production quality and security standards.

**NEVER**:
- Use service role keys in API routes
  → *Why: Bypasses RLS, exposes full database access, critical security vulnerability*
- Bypass Row Level Security policies
  → *Why: Allows unauthorized data access, breaks multi-tenant isolation*
- Expose API keys or sensitive data in client-side code
  → *Why: Keys are visible in browser, can be stolen and abused*
- Create new patterns without understanding existing ones
  → *Why: Breaks consistency, increases maintenance burden, confuses team*
- Skip error handling, input validation, or authentication checks
  → *Why: Creates security holes, crashes app, exposes sensitive errors*
- Use console.log in production code
  → *Why: Leaks information, affects performance, use structured logging instead*
- Use `any` type in TypeScript
  → *Why: Defeats type safety, hides bugs, makes refactoring dangerous*
- Use `alert()` for user feedback
  → *Why: Poor UX, blocks thread, not accessible, use toast notifications*
- Merge or commit directly to main branch
  → *Why: Breaks CI/CD, no review process, can take down production*

**ALWAYS**:
- Use the centralized authentication middleware (`@/lib/auth-middleware`)
- Run `npm run lint` and `npm run typecheck` before marking tasks complete
- Test changes thoroughly including mobile responsiveness (375px width)
- Follow existing code patterns exactly
- Create feature branches for all changes
- Handle errors gracefully with user-friendly messages
- Use proper TypeScript types from `@/types/`
- Validate and sanitize all user inputs
- Check authentication and authorization on every protected route

## Project Information

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript (strict mode)
- **Database**: Supabase (PostgreSQL with Row Level Security)
- **Real-time**: Socket.IO (local) / Supabase Realtime (Vercel production)
- **AI Services**: OpenAI GPT-4o-mini, ElevenLabs TTS/STT
- **Deployment**: Vercel serverless (optimized for edge runtime)
- **Authentication**: Supabase Auth with RLS policies
- **Monitoring**: Sentry error tracking, OpenTelemetry metrics

## ⚡ Quick Reference - Common Tasks

### Adding a New Feature
1. Check existing patterns in similar features first
2. Create feature branch: `git checkout -b feature/name`
3. Use existing UI components from `/src/components/ui/`
4. Follow auth pattern from existing endpoints
5. Test: `npm run lint && npm run typecheck`
6. Push branch but never merge to main directly

### Creating New API Endpoint
→ Copy pattern from `/src/app/api/wiki-document-search/route.ts`
→ Always use `requireAuth` or `requireAdmin` wrapper
→ Always validate input with Zod schemas
→ Always apply rate limiting with `withRateLimit`
→ Return user-friendly error messages

### Adding UI Component
→ Check `/src/components/ui/` for existing components first
→ Use Toast for all notifications (never use alert())
→ Always include loading and error states
→ Test mobile view at 375px width
→ Use TypeScript interfaces for all props

### Modifying Database
→ Never modify schema through API endpoints
→ Use Supabase Dashboard or CLI for migrations
→ Always maintain RLS policies
→ Test queries respect user permissions

## Complete File Structure

```
src/
├── app/                    # Next.js App Router pages and API routes
│   ├── api/               # API endpoints (route.ts files)
│   │   ├── admin/         # Admin-only endpoints (require admin role)
│   │   │   ├── scrape-opencaselist/
│   │   │   ├── scrape-status/
│   │   │   ├── upload-document/
│   │   │   └── reindex-document/
│   │   ├── analysis/      # Debate analysis endpoints
│   │   ├── auth/          # Authentication endpoints
│   │   ├── debate/        # Debate session management
│   │   ├── documents/     # Document upload/retrieval
│   │   ├── elevenlabs/    # Voice services integration
│   │   ├── feedback/      # User feedback system
│   │   ├── judge-feedback/ # AI judge responses
│   │   ├── monitoring/    # Metrics and health checks
│   │   ├── openai/        # GPT integration
│   │   ├── speech-to-text/ # Speech recognition
│   │   ├── user_preferences/ # User settings
│   │   ├── wiki-document-search/ # Database document search
│   │   ├── wiki-search/   # Quick prefix search
│   │   ├── wiki-generate/ # AI content generation
│   │   ├── wiki-rag-search-enhanced/ # Enhanced RAG search
│   │   ├── debug/         # Debug endpoint (protected)
│   │   └── resources/     # Educational resources
│   ├── (authenticated)/   # Protected pages with navigation
│   │   ├── layout.tsx     # Shared authenticated layout
│   │   ├── dashboard/     # User dashboard
│   │   ├── debate/        # Debate interface
│   │   ├── speech-feedback/ # Speech analysis UI
│   │   ├── search/        # Document search UI
│   │   ├── history/       # Debate history
│   │   ├── preferences/   # User preferences UI
│   │   ├── feedback/      # Feedback collection UI
│   │   └── learn/         # Educational resources
│   ├── auth/              # Authentication pages (no nav)
│   │   ├── callback/      # OAuth callback handler
│   │   └── reset-password/ # Password reset flow
│   ├── admin/             # Admin panel pages
│   │   └── documents/     # Document management UI
│   ├── signup/            # User registration
│   ├── privacy/           # Privacy policy
│   ├── terms/             # Terms of service
│   ├── about/             # About page
│   └── page.tsx           # Landing page (public)
├── backend/
│   ├── modules/           # Business logic modules
│   │   ├── realtimeDebate/     # Debate orchestration
│   │   ├── speechFeedback/     # Speech analysis engine
│   │   └── wikiSearch/         # Document retrieval system
│   └── services/          # External service integrations
│       ├── openaiService.ts        # OpenAI GPT client
│       ├── elevenLabsWebSocket.ts  # Voice streaming
│       ├── documentStorageService.ts # File storage
│       └── enhancedIndexingService.ts # Document indexing
├── components/
│   ├── ui/                # Reusable UI components
│   │   ├── FormField.tsx  # Form validation component
│   │   ├── Button.tsx     # Button variants
│   │   ├── Modal.tsx      # Modal dialogs
│   │   ├── Toast.tsx      # Toast notifications
│   │   └── ...            # Other UI primitives
│   ├── auth/              # Authentication components
│   ├── dashboard/         # Dashboard widgets
│   ├── debate/            # Debate-specific components
│   ├── feedback/          # Feedback components
│   │   └── TrainingSection.tsx # Training plan generator
│   ├── layout/            # Layout components
│   ├── pdf/               # PDF viewing components
│   │   └── EnhancedPDFViewer.tsx # Native PDF.js viewer
│   ├── preferences/       # Settings components
│   ├── providers/         # Context providers
│   └── search/            # Search and document components
├── lib/
│   ├── auth-middleware.ts # Centralized authentication (NEW)
│   ├── auth-helpers.ts    # Auth utility functions
│   ├── errorRecovery.ts   # Retry logic and error handling
│   ├── toast.ts           # Toast notification system
│   ├── validation.ts      # Form validation utilities
│   ├── uploadSessionStore.ts # File upload session management
│   ├── envValidation.ts   # Environment variable validation
│   ├── supabaseClient.ts  # Supabase client factory
│   ├── monitoring/        # Telemetry and logging
│   ├── realtime/          # WebSocket management
│   ├── socket/            # Socket.IO client
│   ├── supabase/          # Database types and utilities
│   └── pdf/               # PDF processing utilities
├── middleware/
│   ├── auth.ts            # Edge runtime authentication
│   ├── cors.ts            # CORS configuration
│   ├── inputValidation.ts # Request validation schemas
│   └── rateLimiter.ts     # Rate limiting middleware
├── types/
│   ├── auth.ts            # Authentication types
│   ├── documents.ts       # Document/search types
│   └── index.ts           # Shared type definitions
├── utils/
│   ├── supabase/          # Supabase utilities
│   │   ├── client.ts      # Client-side Supabase
│   │   ├── server.ts      # Server-side Supabase
│   │   └── middleware.ts  # Supabase middleware
│   └── cn.ts              # Classname utility
```

## 🌳 Decision Trees

### Which Authentication Method?
```
Is the endpoint public?
├─ No authentication needed? → No auth wrapper needed (rare)
├─ Optional user context? → Use `optionalAuth`
│  └─ Provides user if logged in, continues if not
├─ Requires user login? → Use `requireAuth`
│  └─ Returns 401 if not authenticated
└─ Admin only? → Use `requireAdmin`
   └─ Returns 403 if not admin role
```

### Which Search Method?
```
What type of search do you need?
├─ Exact phrase/term? → `/api/wiki-document-search`
│  └─ Database full-text search, no AI
├─ Semantic similarity? → `/api/wiki-rag-search-enhanced`
│  └─ Vector embeddings, AI-powered
├─ Quick autocomplete? → `/api/wiki-search`
│  └─ Fast prefix matching
└─ Complex analysis? → Combine multiple endpoints
```

### Error Handling Strategy
```
Where did the error occur?
├─ User input validation? → Return 400 with specific field errors
├─ Authentication failed? → Return 401 with login prompt
├─ Permission denied? → Return 403 with clear message
├─ Resource not found? → Return 404 with helpful context
├─ Server error? → Return 500 with generic message
│  └─ Log full error to Sentry, never expose internals
└─ Rate limited? → Return 429 with retry-after header
```

### Component State Management
```
What type of data?
├─ Server-only data? → Fetch in server component
├─ User interaction? → Use client component with useState
├─ Global app state? → Use context provider
├─ Form data? → Use controlled components with validation
└─ Async data? → Always include loading/error states
```

## Critical Security Patterns

### Centralized Authentication Pattern (REQUIRED)

**Always use the centralized auth middleware for API routes:**

```typescript
// File: src/app/api/[endpoint]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireAdmin, optionalAuth } from '@/lib/auth-middleware';
import { withRateLimit, apiRateLimiter } from '@/middleware/rateLimiter';
import { createClient } from '@/utils/supabase/server';
import { z } from 'zod';

// For authenticated endpoints (rate limit wraps auth)
export async function POST(request: NextRequest) {
  return await withRateLimit(request, apiRateLimiter, async () => {
    return requireAuth(request, async (authenticatedRequest) => {
      // User is available via authenticatedRequest.user
      const user = authenticatedRequest.user;
      
      // Input validation
      const schema = z.object({
        // Define your schema
      });
      
      try {
        const body = await request.json();
        const validated = schema.parse(body);
        
        // Use authenticated Supabase client (respects RLS)
        const supabase = createClient();
        
        // Business logic here
        
        return NextResponse.json({ success: true, data: result });
      } catch (error) {
        if (error instanceof z.ZodError) {
          return NextResponse.json({ error: 'Invalid input', details: error.errors }, { status: 400 });
        }
        console.error(`[${request.url}] Error:`, error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
      }
    });
  });
}

// For admin-only endpoints
export async function DELETE(request: NextRequest) {
  return requireAdmin(request, async (authenticatedRequest) => {
    // Admin user is guaranteed here
    // Implementation...
  });
}

// For optional auth (different behavior for logged in/out)
export async function GET(request: NextRequest) {
  return optionalAuth(request, async (request, user) => {
    if (user) {
      // Authenticated behavior
    } else {
      // Public behavior
    }
  });
}
```

### Component Pattern with Error Handling

```typescript
'use client';

import { useState } from 'react';
import { useToast } from '@/lib/toast';
import { Button } from '@/components/ui/Button';

interface ComponentProps {
  // Define props with proper types
}

export function Component({ props }: ComponentProps) {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAction = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/endpoint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ /* data */ })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Operation failed');
      }

      const result = await response.json();
      toast.success('Operation completed successfully');
      
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An error occurred';
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div>Loading...</div>;
  if (error) return <div className="text-red-600">Error: {error}</div>;

  return (
    <div>
      <Button onClick={handleAction} disabled={loading}>
        Perform Action
      </Button>
    </div>
  );
}
```

### Form Validation Pattern (NO ALERTS)

```typescript
'use client';

import { useState, useMemo } from 'react';
import { useToast } from '@/lib/toast';
import { FormValidator } from '@/lib/validation';
import { FormField } from '@/components/ui/FormField';
import { Button } from '@/components/ui/Button';

export function FormComponent() {
  const toast = useToast();
  const [formData, setFormData] = useState({ email: '', message: '' });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  
  const validator = useMemo(() => new FormValidator({
    email: {
      required: 'Email is required',
      pattern: {
        value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        message: 'Enter a valid email address'
      }
    },
    message: {
      required: 'Message is required',
      minLength: { value: 10, message: 'Message must be at least 10 characters' }
    }
  }), []);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate all fields
    const errors = validator.validateAll(formData);
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      toast.error('Please fix the errors in the form');
      return;
    }
    
    try {
      setSubmitting(true);
      setFormErrors({});
      
      const response = await fetch('/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (!response.ok) throw new Error('Submission failed');
      
      toast.success('Form submitted successfully!');
      setFormData({ email: '', message: '' }); // Reset form
      
    } catch (error) {
      toast.error('Failed to submit form. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };
  
  return (
    <form onSubmit={handleSubmit} noValidate>
      <FormField
        label="Email"
        name="email"
        type="email"
        value={formData.email}
        onChange={(value) => {
          setFormData(prev => ({ ...prev, email: value }));
          if (formErrors.email) {
            setFormErrors(prev => ({ ...prev, email: '' }));
          }
        }}
        error={formErrors.email}
        required
        disabled={submitting}
      />
      
      <FormField
        label="Message"
        name="message"
        type="textarea"
        value={formData.message}
        onChange={(value) => {
          setFormData(prev => ({ ...prev, message: value }));
          if (formErrors.message) {
            setFormErrors(prev => ({ ...prev, message: '' }));
          }
        }}
        error={formErrors.message}
        required
        disabled={submitting}
        rows={4}
      />
      
      <Button type="submit" disabled={submitting}>
        {submitting ? 'Submitting...' : 'Submit'}
      </Button>
    </form>
  );
}
```

### Service Pattern with Error Recovery

```typescript
import { withRetry } from '@/lib/errorRecovery';
import { z } from 'zod';

class ServiceName {
  private readonly baseUrl = process.env.NEXT_PUBLIC_API_URL || '';

  async methodName(params: ParamType): Promise<ReturnType> {
    // Define validation schema
    const schema = z.object({
      // ... define schema
    });

    return withRetry(
      async () => {
        // Validate inputs
        const validated = schema.parse(params);
        
        // Make request
        const response = await fetch(`${this.baseUrl}/api/endpoint`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(validated)
        });
        
        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          throw new Error(error.message || `HTTP ${response.status}`);
        }
        
        return response.json();
      },
      { 
        maxRetries: 3,
        backoffMs: 1000,
        backoffMultiplier: 2,
        shouldRetry: (error) => {
          // Don't retry on 4xx errors
          if (error.message?.includes('4')) return false;
          return true;
        }
      }
    );
  }
}
```

## 📋 Common Workflows

### Workflow: Add New Dashboard Widget

1. **Research existing patterns**:
   ```bash
   ls src/components/dashboard/
   ```
   
2. **Create component file**:
   ```bash
   touch src/components/dashboard/YourWidget.tsx
   ```
   
3. **Copy pattern from existing widget**:
   - Use `StatsCard.tsx` or `StatsSection.tsx` as template
   - Maintain same structure: interface, loading state, error handling
   
4. **Create API endpoint if needed**:
   ```bash
   touch src/app/api/dashboard/your-data/route.ts
   ```
   - Follow pattern from `/src/app/api/wiki-document-search/route.ts`
   - Use `requireAuth` wrapper
   
5. **Add to dashboard page**:
   ```typescript
   // src/app/(authenticated)/dashboard/page.tsx
   import { YourWidget } from '@/components/dashboard/YourWidget';
   
   // Add in grid layout
   <YourWidget />
   ```
   
6. **Test thoroughly**:
   - Loading state (slow network)
   - Error state (API failure)
   - Empty state (no data)
   - Mobile view (375px)

### Workflow: Debug Authentication Issue

1. **Check browser state**:
   - DevTools → Application → Cookies → Look for `sb-*` cookies
   - Network tab → Check for 401/403 responses
   
2. **Verify Supabase session**:
   ```javascript
   // In browser console
   const { data: { session } } = await supabase.auth.getSession()
   console.log(session)
   ```
   
3. **Check server-side auth**:
   - Add temporary logging to `/src/lib/auth-middleware.ts`
   - Check if user object is retrieved correctly
   
4. **Verify RLS policies**:
   - Supabase Dashboard → Authentication → Policies
   - Ensure policies exist for table
   - Test policy with Supabase SQL Editor
   
5. **Test with curl**:
   ```bash
   curl -X POST http://localhost:3001/api/your-endpoint \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"test": "data"}'
   ```

### Workflow: Implement New Form

1. **Create form component**:
   ```typescript
   // src/components/forms/YourForm.tsx
   'use client';
   
   import { useState } from 'react';
   import { useToast } from '@/lib/toast';
   import { FormField } from '@/components/ui/FormField';
   ```
   
2. **Set up validation**:
   - Copy pattern from existing forms
   - Use `FormValidator` from `@/lib/validation`
   - Define Zod schema for type safety
   
3. **Handle submission**:
   - Show loading state during submission
   - Display success toast on completion
   - Show inline errors on validation failure
   - Clear form on success
   
4. **Test edge cases**:
   - Network failure during submission
   - Validation with empty fields
   - Validation with invalid data
   - Concurrent submissions (should be prevented)

## Environment Variables

Complete list in `.env.local`:

```bash
# Supabase (Required)
NEXT_PUBLIC_SUPABASE_URL=              # Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=         # Public anon key
SUPABASE_SERVICE_ROLE_KEY=             # Service role key (server-only!)

# OpenAI (Required)
OPENAI_API_KEY=                        # OpenAI API key
OPENAI_VECTOR_STORE_ID=                # Vector store for RAG
OPENAI_GENERATION_MODEL=gpt-4o-mini    # Model selection

# ElevenLabs (Required for voice features)
ELEVENLABS_API_KEY=                    # ElevenLabs API key
ELEVENLABS_STT_MODEL_ID=eleven_multilingual_v2
ELEVENLABS_CROSSFIRE_AGENT_ID=         # Crossfire agent ID
ELEVENLABS_WEBSOCKET_ENABLED=false     # WebSocket voice streaming

# Application URLs
NEXT_PUBLIC_APP_URL=http://localhost:3001
NEXT_PUBLIC_API_URL=http://localhost:3001
BACKEND_API_URL=http://localhost:3001
NEXT_PUBLIC_APP_DOMAIN=erisdebate.com
NEXT_PUBLIC_SITE_URL=https://erisdebate.com

# Server Configuration
PORT=3001
HOST=localhost
NODE_ENV=development
NEXT_PUBLIC_APP_NAME="Eris Debate"

# Security Keys
DEBUG_API_KEY=                         # Debug endpoint access
DEBUG_ALLOWED_IPS=                     # Comma-separated IPs
ADMIN_SQL_KEY=                         # SQL endpoint (if enabled)
MIGRATIONS_API_KEY=                    # Migrations endpoint
MIGRATIONS_ALLOWED_IPS=                # Allowed IPs for migrations
WIKIFILE_PASS=                         # Wiki file password

# Feature Flags
ENABLE_SQL_ENDPOINT=false              # NEVER enable in production
ENABLE_DEBUG_ENDPOINT=false            # Debug endpoint toggle
NEXT_PUBLIC_USE_SUPABASE_REALTIME=false # Use Supabase vs Socket.IO
SOCKET_IO_FORCE_POLLING=false          # Force polling for Socket.IO

# CORS Configuration (Production)
ALLOWED_ORIGINS=                       # Comma-separated origins

# OpenCaseList Scraper
OPENCASELIST_EMAIL=                    # OpenCaseList login
OPENCASELIST_PASSWORD=                 # OpenCaseList password

# Monitoring & Observability
SENTRY_DSN=                            # Sentry error tracking
NEXT_PUBLIC_SENTRY_DSN=               
SENTRY_AUTH_TOKEN=                    
SENTRY_ORG=                           
SENTRY_PROJECT=                       
ENABLE_SENTRY_DEV=false               
NEXT_PUBLIC_ENABLE_SENTRY_DEV=false   

# OpenTelemetry
OTEL_SERVICE_NAME=eris-debate
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
OTEL_EXPORTER_OTLP_HEADERS=
ENABLE_OTEL_DEV=false
MONITORING_ENDPOINT=
LOG_LEVEL=info

# Vercel Detection (Auto-set by Vercel)
VERCEL=
VERCEL_URL=
NEXT_PUBLIC_VERCEL=
NEXT_RUNTIME=
```

## Key Scripts

```bash
# Development
npm run dev              # Start dev server with Socket.IO backend
npm run build           # Production build
npm run start           # Start production server

# Code Quality (ALWAYS run before commits)
npm run lint            # ESLint checks
npm run typecheck       # TypeScript validation
npm run format:check    # Prettier formatting check
npm run format:write    # Auto-fix formatting

# Testing
npm run test:endpoints  # Test API endpoints
npm run demo           # Run demo test

# Database Management
npm run db:migrate      # Apply migrations
npm run db:check        # Verify database setup
npm run setup-storage   # Setup storage buckets
npm run validate-rag    # Validate RAG configuration

# Deployment & Monitoring
npm run status          # Project status report
npm run analyze:bundle  # Bundle size analysis
npm run check:env       # Validate environment variables
npm run check:port      # Check port availability
```

## Git Workflow

```bash
# 1. Create feature branch
git checkout -b feature/description

# 2. Make changes and test
npm run lint
npm run typecheck
npm run build

# 3. Commit with conventional format
git add .
git commit -m "feat: add new feature

- Implementation detail 1
- Implementation detail 2

Closes #123"

# 4. Push branch
git push origin feature/description

# 5. DO NOT merge to main - User handles PR/merge
```

## Testing Requirements

Before marking ANY task as complete:

1. **Code Quality**
   - ✅ `npm run lint` - No errors
   - ✅ `npm run typecheck` - No type errors
   - ✅ `npm run format:check` - Properly formatted

2. **Functionality**
   - ✅ Feature works in browser
   - ✅ No console errors
   - ✅ API endpoints return expected data
   - ✅ Error cases handled gracefully

3. **Responsiveness**
   - ✅ Desktop view (1920px)
   - ✅ Tablet view (768px)
   - ✅ Mobile view (375px)

4. **Security**
   - ✅ Authentication checked
   - ✅ Input validation working
   - ✅ No sensitive data exposed
   - ✅ RLS policies respected

## Database Schema Key Tables

- `users` - User accounts (managed by Supabase Auth)
- `user_roles` - Role assignments (user/admin)
- `user_preferences` - User settings and preferences
- `debates` - Debate sessions
- `rounds` - Debate rounds
- `speeches` - Individual speeches
- `documents` - Uploaded documents metadata
- `document_chunks` - Chunked document content
- `feedback_submissions` - User feedback
- `speech_feedback_results` - Speech analysis results

## Security Best Practices

1. **Never expose service role key** - Use only in server-side code with extreme caution
2. **Always use RLS** - Database queries should respect Row Level Security
3. **Validate all inputs** - Use Zod schemas for type-safe validation
4. **Sanitize user content** - Prevent XSS and injection attacks
5. **Use HTTPS only** - Enforce secure connections in production
6. **Rate limit all endpoints** - Prevent abuse and DOS attacks
7. **Log security events** - Track authentication failures and suspicious activity
8. **Keep dependencies updated** - Regular security updates

## ❌ Anti-Patterns to Avoid

### BAD: Manual Authentication Checking
```typescript
// ❌ NEVER DO THIS - Inconsistent and error-prone
export async function POST(request: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  // ... rest of handler
}
```

### GOOD: Use Centralized Auth Middleware
```typescript
// ✅ ALWAYS DO THIS - Consistent and secure
export async function POST(request: NextRequest) {
  return requireAuth(request, async (req) => {
    // User is guaranteed to exist here
    const user = req.user;
    // ... rest of handler
  });
}
```

### BAD: Using Service Role Key in API Routes
```typescript
// ❌ NEVER - Bypasses all security
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // CRITICAL VULNERABILITY
);
```

### GOOD: Use Authenticated Client
```typescript
// ✅ ALWAYS - Respects RLS policies
const supabase = createClient(); // Uses authenticated user's permissions
```

### BAD: Exposing Internal Errors
```typescript
// ❌ NEVER - Leaks system information
catch (error) {
  return NextResponse.json({ 
    error: error.message,
    stack: error.stack // NEVER expose stack traces
  }, { status: 500 });
}
```

### GOOD: Generic Error Messages
```typescript
// ✅ ALWAYS - Safe error handling
import { authLogger } from '@/lib/monitoring/logger';

catch (error) {
  // Use structured logging, not console.log
  authLogger.error('API endpoint error', { 
    endpoint: request.url,
    error: error instanceof Error ? error.message : String(error)
  });
  return NextResponse.json({ 
    error: 'An error occurred processing your request'
  }, { status: 500 });
}
```

## 🔧 Troubleshooting Guide

### Problem: "Cannot read properties of undefined"
```
Diagnosis flowchart:
├─ Is it an async operation? → Add 'await' keyword
├─ Is it optional data? → Add optional chaining (?.)
├─ Is it a race condition? → Check useEffect dependencies
└─ Is it SSR/CSR mismatch? → Move to useEffect or use 'use client'
```

**Solution Example**:
```typescript
// Bad
const data = response.data.user.name; // Can crash

// Good
const data = response?.data?.user?.name ?? 'Unknown';
```

### Problem: "Hydration mismatch" Error
```
Common causes:
├─ Using Date() or Math.random() → Move to useEffect
├─ Using window/document → Check typeof window !== 'undefined'
├─ Different server/client state → Use consistent initial state
└─ Missing 'use client' → Add directive to client components
```

**Solution Example**:
```typescript
// Bad
const [time] = useState(new Date().toISOString());

// Good
const [time, setTime] = useState<string>('');
useEffect(() => {
  setTime(new Date().toISOString());
}, []);
```

### Problem: Build Fails
```bash
# Quick fix sequence:
rm -rf .next node_modules      # Clear caches
npm install                     # Reinstall deps
npm run typecheck              # Check TypeScript
npm run lint                   # Check linting
npm run build                  # Try build again
```

### Problem: Authentication Not Working
```
Debug checklist:
├─ Check cookies exist (sb-* cookies in browser)
├─ Verify token not expired (check exp claim)
├─ Confirm RLS policies (Supabase Dashboard)
├─ Test with fresh login
└─ Check CORS settings (for cross-origin requests)
```

### Problem: Database Query Returns Empty
```
Investigation steps:
├─ Check RLS policies for table
├─ Verify user has permission (user_id matches)
├─ Test query in Supabase SQL Editor
├─ Check if data exists in table
└─ Verify authenticated client is used
```

## Recent Critical Updates (August 2025)

### Security Fixes (Deployed Aug 18, 2025)
- ✅ Removed service role key vulnerabilities from 15 API endpoints
- ✅ Implemented centralized authentication middleware
- ✅ Added server-side route protection via Edge Runtime
- ✅ Enforced admin role verification
- ✅ Disabled dangerous SQL and migration endpoints
- ✅ Fixed client-side only route protection vulnerability

### Feature Enhancements
- ✅ Enhanced feedback with step-by-step training instructions
- ✅ Personalized training plans based on skill level
- ✅ Native PDF viewer with PDF.js integration
- ✅ Professional form validation (no browser alerts)
- ✅ Comprehensive toast notification system

## Common Debugging

1. **Authentication Issues**
   - Check Supabase Auth state: `supabase.auth.getUser()`
   - Verify RLS policies in Supabase dashboard
   - Check middleware auth in `/src/middleware/auth.ts`

2. **API Errors**
   - Browser DevTools → Network tab
   - Server logs in terminal
   - Check rate limiting
   - Verify environment variables

3. **Build Failures**
   - Clear `.next` folder: `rm -rf .next`
   - Clear node_modules: `rm -rf node_modules && npm install`
   - Check TypeScript errors: `npm run typecheck`

4. **WebSocket Issues**
   - Check CORS configuration
   - Verify Socket.IO server is running
   - Check `NEXT_PUBLIC_USE_SUPABASE_REALTIME` flag

## ⚡ Performance Guidelines

### Database Optimization
- **Always paginate**: Limit queries to 20-50 items
- **Use indexes**: Check Supabase Dashboard → Database → Indexes
- **Avoid N+1 queries**: Use joins instead of multiple queries
- **Cache expensive computations**: Use React.memo, useMemo
- **Use select specific columns**: Don't fetch unnecessary data

### Frontend Performance
- **Lazy load heavy components**:
  ```typescript
  const PDFViewer = dynamic(() => import('@/components/pdf/EnhancedPDFViewer'), {
    loading: () => <div>Loading PDF viewer...</div>,
    ssr: false
  });
  ```
- **Use loading.tsx**: For route transitions
- **Optimize images**: Use next/image with proper sizing
- **Minimize client state**: Keep state close to where it's used
- **Debounce user input**: For search, autosave features

### API Performance Targets
- **Read operations**: < 200ms response time
- **Write operations**: < 500ms response time
- **Search operations**: < 1000ms response time
- **File uploads**: Show progress indicator
- **Long operations**: Use background jobs or streaming

### Bundle Size Optimization
- **Tree shake imports**: Import only what you need
- **Analyze bundle**: `npm run analyze:bundle`
- **Code split routes**: Automatic with App Router
- **Minimize dependencies**: Audit with `npm ls`

## 🚀 Pre-Deployment Checklist

### Code Quality
- [ ] Build succeeds: `npm run build`
- [ ] No TypeScript errors: `npm run typecheck`
- [ ] No lint errors: `npm run lint`
- [ ] Code formatted: `npm run format:check`
- [ ] No console.log statements in code
- [ ] All TODO comments resolved

### Security
- [ ] Environment variables set in Vercel Dashboard
- [ ] No hardcoded secrets or API keys
- [ ] All endpoints have authentication
- [ ] Rate limiting configured
- [ ] CORS properly configured
- [ ] Input validation on all forms
- [ ] SQL injection prevention (parameterized queries)

### Database
- [ ] All migrations applied to production
- [ ] RLS policies verified and tested
- [ ] Indexes created for frequently queried columns
- [ ] Backup strategy in place
- [ ] Connection pooling configured

### User Experience
- [ ] Mobile responsive (test at 375px, 768px, 1920px)
- [ ] Loading states for all async operations
- [ ] Error messages are user-friendly
- [ ] Forms have proper validation feedback
- [ ] Toast notifications for user actions
- [ ] Accessibility: ARIA labels, keyboard navigation

### Monitoring
- [ ] Sentry error tracking enabled
- [ ] API endpoint monitoring configured
- [ ] Performance metrics tracked
- [ ] Logging configured (no sensitive data)
- [ ] Health check endpoint working

### Final Checks
- [ ] Test critical user flows in staging
- [ ] Verify all integrations (OpenAI, ElevenLabs)
- [ ] Check rate limits are appropriate
- [ ] Review recent commits for issues
- [ ] Document any breaking changes

## DO NOT

1. Create new files unless absolutely necessary
2. Add console.log statements (use existing logging)
3. Change established patterns without discussion
4. Install new dependencies without approval
5. Modify database schema without migrations
6. Expose sensitive data in API responses
7. Skip error handling or validation
8. Ignore TypeScript errors or use `@ts-ignore`
9. Use `any` type instead of proper types
10. Commit directly to main branch