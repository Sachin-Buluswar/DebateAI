# 🔧 How to Fix Authentication Vulnerabilities - Step by Step

## Quick Fix Script (Run These Commands)

### Step 1: Find All Service Role Key Usage
```bash
# List all files using service role key
grep -r "SUPABASE_SERVICE_ROLE_KEY" src/app/api --include="*.ts" --include="*.tsx"
```

### Step 2: Replace Service Role with Authenticated Client

For each file found, make these changes:

#### ❌ VULNERABLE CODE (Current)
```typescript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  // No auth check
  const data = await supabase.from('table').select();
  // ...
}
```

#### ✅ SECURE CODE (Fixed)
```typescript
import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  // Create authenticated client
  const supabase = createClient();
  
  // Check authentication
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  
  if (authError || !user) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }
  
  // Now safe to query - RLS policies will be enforced
  const { data, error } = await supabase
    .from('table')
    .select()
    .eq('user_id', user.id); // Filter by authenticated user
    
  // ...
}
```

---

## Files That Need Immediate Fixes

### 1. `/api/wiki-document-search/route.ts`
```typescript
// Add at the top
import { createClient } from '@/utils/supabase/server';

// Replace the service role client
// DELETE THESE LINES:
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// In the POST function, add:
export async function POST(request: NextRequest) {
  return await withRateLimit(request, wikiSearchRateLimiter, async () => {
    // ADD AUTH CHECK
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return addSecurityHeaders(
        NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      );
    }
    
    // Rest of the function...
  });
}
```

### 2. `/api/wiki-index/route.ts`
```typescript
// Same pattern - remove service role, add auth check
```

### 3. `/api/search-status/route.ts`
```typescript
// This might be a health check - consider if it needs auth
// If it's for monitoring, maybe keep it public but remove sensitive data
```

### 4. `/api/resources/setup/route.ts`
```typescript
// This is CRITICAL - it can modify the database!
// Must add admin role check:

const supabase = createClient();
const { data: { user } } = await supabase.auth.getUser();

if (!user) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

// Check admin role
const { data: role } = await supabase
  .from('user_roles')
  .select('role')
  .eq('user_id', user.id)
  .single();

if (role?.role !== 'admin' && role?.role !== 'super_admin') {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}
```

---

## Create Auth Middleware Helper

Create `/src/lib/auth-middleware.ts`:
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export interface AuthenticatedRequest extends NextRequest {
  user?: any;
}

export async function requireAuth(
  request: NextRequest,
  handler: (request: AuthenticatedRequest) => Promise<NextResponse>
): Promise<NextResponse> {
  const supabase = createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  
  if (error || !user) {
    return NextResponse.json(
      { error: 'Unauthorized. Please log in.' },
      { status: 401 }
    );
  }
  
  // Attach user to request
  (request as AuthenticatedRequest).user = user;
  
  return handler(request as AuthenticatedRequest);
}

export async function requireAdmin(
  request: NextRequest,
  handler: (request: AuthenticatedRequest) => Promise<NextResponse>
): Promise<NextResponse> {
  const supabase = createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  
  if (error || !user) {
    return NextResponse.json(
      { error: 'Unauthorized. Please log in.' },
      { status: 401 }
    );
  }
  
  // Check admin role
  const { data: roleData } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .single();
    
  if (!roleData || (roleData.role !== 'admin' && roleData.role !== 'super_admin')) {
    return NextResponse.json(
      { error: 'Forbidden. Admin access required.' },
      { status: 403 }
    );
  }
  
  (request as AuthenticatedRequest).user = user;
  return handler(request as AuthenticatedRequest);
}
```

---

## Use the New Middleware

### For Regular Protected Routes:
```typescript
import { requireAuth } from '@/lib/auth-middleware';

export async function POST(request: NextRequest) {
  return requireAuth(request, async (req) => {
    // req.user is now available and verified
    const userId = req.user.id;
    
    // Your logic here
    return NextResponse.json({ success: true });
  });
}
```

### For Admin Routes:
```typescript
import { requireAdmin } from '@/lib/auth-middleware';

export async function POST(request: NextRequest) {
  return requireAdmin(request, async (req) => {
    // User is authenticated AND has admin role
    
    // Your admin logic here
    return NextResponse.json({ success: true });
  });
}
```

---

## Testing Your Fixes

### Test Unauthenticated Access:
```bash
# Should return 401 Unauthorized
curl -X POST http://localhost:3001/api/wiki-document-search \
  -H "Content-Type: application/json" \
  -d '{"query": "test"}'
```

### Test With Authentication:
```bash
# First, get a token by logging in
# Then test with the token
curl -X POST http://localhost:3001/api/wiki-document-search \
  -H "Content-Type: application/json" \
  -H "Cookie: sb-access-token=YOUR_TOKEN" \
  -d '{"query": "test"}'
```

### Test Admin Routes:
```bash
# Should fail without admin role
curl -X POST http://localhost:3001/api/admin/upload-document \
  -H "Cookie: sb-access-token=USER_TOKEN"
  
# Should work with admin role
curl -X POST http://localhost:3001/api/admin/upload-document \
  -H "Cookie: sb-access-token=ADMIN_TOKEN"
```

---

## Verification Checklist

After making changes, verify:

- [ ] No files contain `SUPABASE_SERVICE_ROLE_KEY` except auth callback
- [ ] All API routes check authentication
- [ ] Admin routes check for admin role
- [ ] Unauthenticated requests return 401
- [ ] RLS policies are working (test data access)
- [ ] Build completes without errors: `npm run build`
- [ ] No TypeScript errors: `npm run typecheck`

---

## Emergency Disable (If Needed)

If you discover active exploitation, immediately disable vulnerable endpoints:

```typescript
// Temporary disable
export async function POST() {
  return NextResponse.json(
    { error: 'Endpoint temporarily disabled for maintenance' },
    { status: 503 }
  );
}
```

---

*Fix Guide Created: January 18, 2025*
*Estimated Time: 4-6 hours for complete fix*
*Priority: CRITICAL - Fix before any deployment*