# 🚨 IMMEDIATE ACTIONS REQUIRED - Authentication Crisis

## DO THIS NOW (15 Minutes)

### 1. Disable Vulnerable Endpoints (5 minutes)
Create `/src/app/api/security-block.ts`:
```typescript
import { NextResponse } from 'next/server';

export function blockEndpoint(reason = 'Security update in progress') {
  return NextResponse.json(
    { error: reason },
    { status: 503 }
  );
}
```

Apply to these critical endpoints IMMEDIATELY:
- `/api/wiki-document-search/route.ts` 
- `/api/wiki-index/route.ts`
- `/api/resources/setup/route.ts`
- `/api/migrations/route.ts`
- `/api/debug/route.ts`

```typescript
import { blockEndpoint } from '../security-block';

export async function POST() {
  return blockEndpoint(); // Temporary disable
}

export async function GET() {
  return blockEndpoint(); // Temporary disable
}
```

### 2. Remove Service Role Key from Environment (5 minutes)

In your Vercel/hosting dashboard:
1. Go to Environment Variables
2. Find `SUPABASE_SERVICE_ROLE_KEY`
3. Either:
   - DELETE it completely (recommended)
   - Or rename to `SUPABASE_SERVICE_ROLE_KEY_DISABLED`

This will cause vulnerable endpoints to fail safely rather than expose data.

### 3. Emergency RLS Tightening (5 minutes)

Run this SQL in Supabase immediately:
```sql
-- Ensure RLS is enabled on ALL tables
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN SELECT tablename FROM pg_tables 
    WHERE schemaname = 'public' 
    LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', r.tablename);
    END LOOP;
END $$;

-- Double-check critical tables
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.debate_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.speech_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create emergency deny-all policy for sensitive tables
CREATE POLICY "emergency_lockdown" ON public.user_roles
  FOR ALL USING (false);
  
-- Check what's exposed
SELECT 
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY rowsecurity, tablename;
```

---

## Then Fix Properly (4-6 hours)

### Phase 1: Service Role Removal (2 hours)
Go through each of these files and fix:

| File | Current Issue | Fix Required |
|------|--------------|--------------|
| `/api/wiki-document-search` | Service role, no auth | Add auth check, use server client |
| `/api/wiki-index` | Service role, no auth | Add auth check, use server client |
| `/api/wiki-rag-search-direct` | Service role, no auth | Add auth check, use server client |
| `/api/search-status` | Service role | May be health check - review |
| `/api/rag-status` | Service role | May be health check - review |
| `/api/resources/setup` | Service role, can modify DB! | Add admin check, use server client |
| `/api/debug` | Debug with service role | Disable in production |
| `/api/migrations` | Can run migrations! | Add admin check or disable |
| `/api/monitoring/metrics` | Exposes metrics | Add auth or limit data |
| `/api/monitoring/health` | May expose data | Review what's exposed |

### Phase 2: Add Auth Middleware (1 hour)
1. Create `/src/middleware/auth.ts`
2. Update main middleware to check auth
3. Test all protected routes

### Phase 3: Fix Client-Side Protection (1 hour)
1. Add server-side checks to layout
2. Move admin pages to authenticated layout
3. Add loading states

---

## Verification Commands

### Check for Service Role Key Usage:
```bash
# Should return NOTHING after fixes
grep -r "SUPABASE_SERVICE_ROLE_KEY" src/app/api --include="*.ts"
```

### Test Endpoints Are Protected:
```bash
# Should all return 401 or 503
curl http://localhost:3001/api/wiki-document-search
curl http://localhost:3001/api/resources/setup
curl http://localhost:3001/api/migrations
```

### Check RLS is Enabled:
```sql
-- Run in Supabase SQL Editor
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
  AND rowsecurity = false;
-- Should return NO ROWS
```

---

## What Could Be Compromised Already?

If your app is deployed, assume:
- ❌ All documents and chunks could be read
- ❌ Search history could be accessed
- ❌ User profiles might be exposed
- ❌ Debate sessions could be viewed
- ⚠️ Data might have been modified

### Check for Compromise:
```sql
-- Check for suspicious activity
SELECT 
  user_id,
  COUNT(*) as request_count,
  MAX(created_at) as last_request
FROM debate_sessions
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY user_id
HAVING COUNT(*) > 10
ORDER BY request_count DESC;

-- Check for data modifications
SELECT 
  tablename,
  COUNT(*) as recent_updates
FROM (
  SELECT 'documents' as tablename, updated_at 
  FROM documents 
  WHERE updated_at > NOW() - INTERVAL '24 hours'
  UNION ALL
  SELECT 'user_profiles', updated_at 
  FROM user_profiles 
  WHERE updated_at > NOW() - INTERVAL '24 hours'
) recent
GROUP BY tablename;
```

---

## Communication Plan

If the app is live with users:

### User Notification Template:
> We are performing emergency security maintenance to enhance the protection of your data. Some features may be temporarily unavailable. We expect to complete this work within 2 hours. No user action is required.

### If Data Was Compromised:
> We have identified and fixed a security vulnerability. While we have no evidence of unauthorized access, out of an abundance of caution, we recommend you change your password. We sincerely apologize for any inconvenience.

---

## Post-Fix Validation

After all fixes are complete:

- [ ] All API routes require authentication
- [ ] Service role key is completely removed from code
- [ ] Admin routes check for admin role
- [ ] RLS is enabled on all tables
- [ ] No sensitive data in public endpoints
- [ ] Build passes: `npm run build`
- [ ] Type checking passes: `npm run typecheck`
- [ ] Manual testing of all features works
- [ ] Penetration test key endpoints

---

*Emergency Response Plan*
*Created: January 18, 2025*
*Priority: CRITICAL - EXECUTE IMMEDIATELY*