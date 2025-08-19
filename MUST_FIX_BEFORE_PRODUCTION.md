# 🚨 MUST FIX BEFORE PRODUCTION - Critical Issues Only

## Time Required: 4-6 hours total

---

## 1. 🔴 PROTECT ADMIN ROUTES (30 minutes)
**CRITICAL - Anyone can access admin functions!**

### Quick Fix:
```sql
-- Run this in Supabase SQL Editor NOW:
-- (Already created as SQL_ADMIN_ROLE_SYSTEM.sql)

-- After running the SQL, update line 152 with your email:
INSERT INTO public.user_roles (user_id, role) 
SELECT id, 'super_admin' FROM auth.users 
WHERE email = 'YOUR_ADMIN_EMAIL@gmail.com';
```

### Then add this check to ALL admin routes:
```typescript
// Add to: /api/admin/*/route.ts files
const { data: { user } } = await supabase.auth.getUser();
if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

const { data: role } = await supabase
  .from('user_roles')
  .select('role')
  .eq('user_id', user.id)
  .single();

if (!role || (role.role !== 'admin' && role.role !== 'super_admin')) {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}
```

---

## 2. 🔴 ADD SECURITY HEADERS (10 minutes)
**File:** `/src/middleware.ts`

Add these lines after line 44 (after CSP headers):

```typescript
// Add these security headers for production
response.headers.set('X-Frame-Options', 'DENY');
response.headers.set('X-Content-Type-Options', 'nosniff');
response.headers.set('X-XSS-Protection', '1; mode=block');
response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
response.headers.set('Permissions-Policy', 'camera=(), microphone=(self), geolocation=()');
if (process.env.NODE_ENV === 'production') {
  response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
}
```

---

## 3. 🔴 REMOVE SQL ENDPOINT (5 minutes)
**CRITICAL SECURITY RISK**

### Option A: Delete the file (Recommended)
```bash
rm src/app/api/sql/route.ts
git add -A
git commit -m "security: remove SQL endpoint for production"
```

### Option B: Add hard block
```typescript
// At the very top of /api/sql/route.ts
export async function POST() {
  return NextResponse.json({ error: 'Endpoint disabled' }, { status: 403 });
}
```

---

## 4. 🟡 ADD DATABASE INDEXES (10 minutes)
**Run in Supabase SQL Editor:**

```sql
-- Already created as SQL_PERFORMANCE_INDEXES.sql
-- This will prevent slow queries at scale
```

---

## 5. 🟡 SYNC DATABASE MIGRATIONS (15 minutes)
**Prevents deployment failures:**

```bash
# Pull remote migrations
npx supabase db pull

# Commit them
git add supabase/migrations/
git commit -m "sync: production database migrations"
git push origin feature/add-migrations-auth
```

---

## 6. 🟡 SET PRODUCTION ENV VARIABLES (20 minutes)
**In Vercel/Your Hosting Platform:**

### Required (App won't work without these):
```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
OPENAI_API_KEY=
ELEVENLABS_API_KEY=
```

### Critical for Security:
```env
ENABLE_SQL_ENDPOINT=false
ENABLE_DEBUG_ENDPOINT=false
NODE_ENV=production
ALLOWED_ORIGINS=https://erisdebate.com,https://www.erisdebate.com
```

### For Monitoring (Recommended):
```env
SENTRY_DSN=
SENTRY_AUTH_TOKEN=
```

---

## 7. 🟡 FIX SPEECH FEEDBACK APIS (2-3 hours)
**Fix these 4 files to use authenticated client:**

1. `/api/speech-feedback/init/route.ts`
2. `/api/speech-feedback/chunk/route.ts`
3. `/api/speech-feedback/finalize/route.ts`
4. `/api/speech-feedback/cancel/route.ts`

### Pattern to follow (from the fixed files):
```typescript
// CHANGE FROM:
import { createClient } from '@supabase/supabase-js';
const supabase = createClient(url, serviceKey);

// CHANGE TO:
import { createClient } from '@/utils/supabase/server';
const supabase = createClient();
const { data: { user } } = await supabase.auth.getUser();
if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
```

---

## ⚡ QUICK TEST CHECKLIST (30 minutes)

After fixes, test these critical paths:

### 1. Auth Flow
- [ ] Sign up with new email
- [ ] Verify email
- [ ] Log in
- [ ] Log out

### 2. Core Features
- [ ] Create a debate
- [ ] Upload speech for feedback
- [ ] View feedback results
- [ ] Check history page

### 3. Security Tests
- [ ] Try accessing `/api/admin/upload-document` without admin role (should fail)
- [ ] Try accessing `/api/sql` (should be blocked)
- [ ] Check browser console for security headers

### 4. Performance Check
- [ ] Load dashboard (should be < 2 seconds)
- [ ] Upload 10MB audio file (should work)
- [ ] Check for any console errors

---

## 📊 RISK IF NOT FIXED

| Issue | Risk if Ignored | Time to Fix |
|-------|----------------|-------------|
| Admin routes unprotected | **CRITICAL** - Data breach | 30 min |
| Missing security headers | **HIGH** - XSS, clickjacking | 10 min |
| SQL endpoint exists | **CRITICAL** - Database compromise | 5 min |
| No DB indexes | **MEDIUM** - Slow at scale | 10 min |
| Migrations out of sync | **MEDIUM** - Deploy fails | 15 min |
| Service role in APIs | **HIGH** - Bypassed security | 3 hours |

---

## ✅ DEFINITION OF DONE

You can deploy to production when:

1. ✅ Admin routes return 403 for non-admins
2. ✅ Security headers visible in browser DevTools
3. ✅ SQL endpoint removed or returns 403
4. ✅ Database indexes created (check Supabase dashboard)
5. ✅ Migrations synced (no errors on `npx supabase db push`)
6. ✅ All environment variables set in production
7. ✅ Auth flow works end-to-end
8. ✅ Core features tested and working

---

## 🚀 DEPLOYMENT COMMAND

Once everything above is done:

```bash
# Final checks
npm run build
npm run typecheck
npm run lint

# Deploy (Vercel)
vercel --prod

# Or git push to main if auto-deploy is setup
git push origin main
```

---

**CRITICAL**: Do NOT deploy until at least issues #1-3 are fixed. These are active security vulnerabilities.

**Time Estimate**: 
- Minimum fixes (#1-3): 45 minutes
- Recommended fixes (#1-6): 4 hours  
- All fixes (#1-7): 6-7 hours

---

*Your app is 85% ready. These fixes will get you to 95%+*