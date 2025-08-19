# 🔧 Service Role Security Fix Instructions

## Overview
The `speechFeedbackService.ts` and other backend services legitimately need service role access for file operations, but API routes should use authenticated clients. Here's how to fix this properly.

## Architecture Pattern

### ✅ Correct Pattern:
```
Client → API Route (auth client) → Backend Service (service role for storage only)
```

### ❌ Current Problem:
```
Client → API Route (service role) → Backend Service (service role)
```

## Files That Need Fixing

### 1. Speech Feedback APIs
These files need to be updated to use authenticated client for database operations:

#### `/api/speech-feedback/route.ts`
```typescript
// BEFORE (Wrong):
const supabase = createClient(url, serviceKey);

// AFTER (Correct):
import { createClient } from '@/utils/supabase/server';
const supabase = createClient(); // For database operations

// Keep service in backend for storage:
const result = await speechFeedbackService.processSpeech({
  // Service handles storage with service role
});
```

#### `/api/speech-feedback/init/route.ts`
#### `/api/speech-feedback/chunk/route.ts`
#### `/api/speech-feedback/finalize/route.ts`
#### `/api/speech-feedback/cancel/route.ts`

### 2. Debate APIs (Already Fixed)
✅ `/api/debate/start/route.ts` - FIXED
- `/api/debate/end/route.ts` - Needs fix
- `/api/debate/realtime/route.ts` - Needs fix
- `/api/debate/speech/route.ts` - Needs fix

### 3. Admin APIs (Need Role Checking)
- `/api/admin/upload-document/route.ts`
- `/api/admin/scrape-opencaselist/route.ts`
- `/api/admin/reindex-document/route.ts`

## Implementation Guide

### Step 1: Fix API Route Pattern
```typescript
// api/speech-feedback/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { speechFeedbackService } from '@/backend/modules/speechFeedback/speechFeedbackService';

export async function POST(request: NextRequest) {
  // 1. Check auth with regular client
  const supabase = createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 2. Process request
  const formData = await request.formData();
  const audioFile = formData.get('audio') as File;
  
  // 3. Let service handle storage with service role
  const result = await speechFeedbackService.processSpeech({
    audioBuffer: Buffer.from(await audioFile.arrayBuffer()),
    userId: user.id,
    // ... other params
  });

  // 4. Save to database with user's permissions
  const { data, error: dbError } = await supabase
    .from('speech_feedback')
    .insert({
      user_id: user.id,
      feedback: result.feedback,
      audio_url: result.audioUrl,
      // ... other fields
    })
    .select()
    .single();

  if (dbError) {
    return NextResponse.json({ error: 'Failed to save feedback' }, { status: 500 });
  }

  return NextResponse.json(data);
}
```

### Step 2: Keep Service Role in Backend Services
```typescript
// backend/modules/speechFeedback/speechFeedbackService.ts
// This is CORRECT - services need service role for storage operations
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

// Used for:
// - Storage bucket operations
// - Bypassing RLS for system operations
// - Background jobs
```

### Step 3: Add Admin Role Checking
```typescript
// api/admin/upload-document/route.ts
import { createClient } from '@/utils/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
  // 1. Check if user is admin
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  // 2. Verify admin role
  const { data: role } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .single();
  
  if (!role || (role.role !== 'admin' && role.role !== 'super_admin')) {
    return NextResponse.json({ error: 'Forbidden - Admin only' }, { status: 403 });
  }
  
  // 3. NOW use service role for admin operations
  const adminClient = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  
  // Admin operations...
}
```

## Testing After Each Fix

### 1. Test Authentication
```bash
# Should return 401 without auth
curl -X POST http://localhost:3001/api/speech-feedback

# Should work with auth cookie
# (test in browser while logged in)
```

### 2. Test Permissions
- Create speech feedback as User A
- Try to access it as User B (should fail)
- Try to access it as User A (should work)

### 3. Test Admin Functions
- Try admin endpoint as regular user (should get 403)
- Try admin endpoint as admin (should work)

## Security Benefits After Fix

| Before | After |
|--------|-------|
| All operations bypass RLS | Operations respect user permissions |
| No audit trail | Full audit trail of who did what |
| Admin functions accessible to all | Admin functions require admin role |
| Performance issues hidden | Real performance visible |
| Security vulnerabilities | Secure by default |

## Files to Update Priority

### Week 1 (Critical)
1. [ ] `/api/speech-feedback/route.ts`
2. [ ] `/api/speech-feedback/init/route.ts`
3. [ ] `/api/speech-feedback/finalize/route.ts`
4. [ ] `/api/debate/end/route.ts`
5. [ ] `/api/debate/realtime/route.ts`

### Week 2 (Important)
1. [ ] `/api/admin/upload-document/route.ts`
2. [ ] `/api/admin/scrape-opencaselist/route.ts`
3. [ ] `/api/admin/reindex-document/route.ts`
4. [ ] `/api/wiki-index/route.ts`
5. [ ] `/api/resources/setup/route.ts`

### Week 3 (Cleanup)
1. [ ] Remove unused imports
2. [ ] Add monitoring
3. [ ] Update documentation
4. [ ] Add tests

## Monitoring After Fix

Add this to each fixed endpoint:
```typescript
console.log(`[API] ${request.url} - User: ${user.id} - ${new Date().toISOString()}`);
```

Watch for:
- 401 errors (auth working correctly)
- 403 errors (permissions working)
- 500 errors (possible RLS issues)

## Common Issues After Fix

| Error | Cause | Solution |
|-------|-------|----------|
| "permission denied for table" | RLS policy too restrictive | Review and adjust policy |
| "authentication required" | No auth cookie | Ensure user is logged in |
| "forbidden" | User not admin | Working as intended |
| "Failed to upload" | Storage permissions | Keep service role for storage |

---

**Priority**: CRITICAL  
**Time to Fix All**: 2-3 weeks  
**Risk Reduction**: 90% after first week  

Remember: The goal is to use the authenticated client for database operations and service role ONLY for storage/system operations.