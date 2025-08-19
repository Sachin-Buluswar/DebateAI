# 🔒 SERVICE ROLE KEY SECURITY AUDIT

## 🚨 Critical Finding: 97 Files Using Service Role Key

The `SUPABASE_SERVICE_ROLE_KEY` bypasses ALL Row Level Security. It should ONLY be used for:
- System-level operations
- Admin functions with proper role checking
- Migrations and setup scripts

## 📊 Usage Breakdown by Category

### 🔴 HIGH RISK - User-Facing APIs (Must Fix Immediately)
These routes handle user data and should use authenticated client:

| File | Current Risk | Required Change |
|------|-------------|-----------------|
| `/api/debate/start/route.ts` | Bypasses user auth | Use `createClient()` from utils/supabase/server |
| `/api/debate/end/route.ts` | Bypasses user auth | Use authenticated client |
| `/api/debate/realtime/route.ts` | Bypasses RLS | Use authenticated client |
| `/api/debate/speech/route.ts` | Bypasses RLS | Use authenticated client |
| `/api/speech-feedback/*` routes | All bypass RLS | Use authenticated client |

### 🟠 MEDIUM RISK - Mixed Admin/User Routes
These need role checking before using service role:

| File | Issue | Fix Required |
|------|-------|--------------|
| `/api/admin/upload-document` | No role check | Add admin role verification |
| `/api/admin/scrape-opencaselist` | No role check | Add admin role verification |
| `/api/admin/reindex-document` | No role check | Add admin role verification |
| `/api/wiki-index/route.ts` | Public but uses service | Add conditional logic |
| `/api/resources/setup/route.ts` | Setup but no auth | Add API key requirement |

### 🟡 ACCEPTABLE USAGE - System Operations
These legitimately need service role:

| File | Purpose | Status |
|------|---------|--------|
| `/pages/api/socketio.ts` | WebSocket server | ✅ OK - System level |
| `scripts/*.js` | Migration/setup scripts | ✅ OK - Admin tools |
| `/api/migrations/route.ts` | Database migrations | ✅ OK with API key |
| `/api/sql/route.ts` | Admin SQL access | ✅ OK with API key |
| `/api/monitoring/*` | System monitoring | ✅ OK - System level |

## 🔧 Fix Templates

### Template 1: User-Facing API Fix
```typescript
// ❌ REMOVE THIS
import { createClient } from '@supabase/supabase-js';
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ✅ REPLACE WITH THIS
import { createClient } from '@/utils/supabase/server';

export async function POST(request: NextRequest) {
  const supabase = createClient();
  
  // Check user is authenticated
  const { data: { user }, error } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  // Now queries use user's permissions
  const { data, error: queryError } = await supabase
    .from('table')
    .select('*');
}
```

### Template 2: Admin Route Fix
```typescript
// ✅ PROPER ADMIN ROUTE
import { createClient } from '@/utils/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
  // First check if user is admin using regular client
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
  
  // NOW use service role for admin operations
  const adminClient = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  
  // Admin operations here
}
```

## 📝 Migration Priority List

### Week 1 (Critical Security Fixes)
1. [ ] Fix `/api/debate/start/route.ts`
2. [ ] Fix `/api/debate/end/route.ts`
3. [ ] Fix `/api/debate/realtime/route.ts`
4. [ ] Fix `/api/debate/speech/route.ts`
5. [ ] Fix all `/api/speech-feedback/*` routes

### Week 2 (Admin Security)
1. [ ] Add role checking to `/api/admin/*` routes
2. [ ] Add API key to `/api/resources/setup/route.ts`
3. [ ] Review `/api/wiki-*` routes for proper auth

### Week 3 (Cleanup)
1. [ ] Remove unused service role imports
2. [ ] Add monitoring for service role usage
3. [ ] Document proper patterns in CLAUDE.md

## 🎯 Testing After Each Fix

After fixing each route, test:
1. **Functionality**: Does the feature still work?
2. **Permissions**: Can users only access their own data?
3. **Admin Access**: Do admin features require admin role?
4. **Error Handling**: Are errors user-friendly?

## 📊 Current Statistics

| Metric | Count | Target |
|--------|-------|--------|
| Total files with service role | 97 | <20 |
| User-facing APIs with service role | ~15 | 0 |
| Admin APIs without role check | ~5 | 0 |
| Legitimate system uses | ~20 | ~20 |

## 🚨 Security Impact

**Current Risk Level**: HIGH
- Any authenticated user can potentially access all data
- RLS policies are bypassed everywhere
- No audit trail of who accessed what
- Performance issues hidden by bypass

**After Fix**: LOW
- Users can only access their permitted data
- RLS policies enforced
- Proper audit trail
- Real performance characteristics visible

## 📈 Monitoring Post-Fix

Add logging to track:
```typescript
// Add to each API route after fix
console.log(`[${new Date().toISOString()}] API: ${request.url}, User: ${user?.id}, Method: ${request.method}`);
```

Monitor for:
- Permission denied errors (might need policy adjustments)
- Performance degradation (was hidden by service role)
- Failed admin access (role checking working)

---

**Priority**: CRITICAL  
**Estimated Time**: 2-3 weeks for full remediation  
**Risk Reduction**: 90% after Week 1 fixes  

---

*Generated: February 17, 2025*