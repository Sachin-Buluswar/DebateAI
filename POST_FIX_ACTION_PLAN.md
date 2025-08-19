# 📋 POST-FIX ACTION PLAN - Eris Debate Platform

## ✅ What's Fixed
- ✅ **Database Permissions**: All tables now have proper GRANT permissions
- ✅ **Authentication Path**: user_profiles can now be created/read/updated
- ✅ **Core Features**: Database operations should now work

## 🔍 What Still Needs Attention

### 1. 🧪 **IMMEDIATE TESTING REQUIRED** (Do This Now!)

#### Test Authentication Flow
1. **Sign Up Test**:
   - Go to `/auth`
   - Register with a NEW email
   - ✅ Should redirect to dashboard
   - ❌ If error: Check browser console and network tab

2. **Login Test**:
   - Sign out
   - Login with existing account
   - ✅ Should redirect to dashboard
   - ❌ If error: Profile might not exist

3. **Profile Test**:
   - Go to `/preferences`
   - Update any preference
   - ✅ Should save without errors
   - ❌ If error: Update permissions might be incomplete

#### Test Core Features
4. **Debate Creation**:
   - Go to `/debate`
   - Start a new debate
   - ✅ Should create session
   - ❌ If error: debate_sessions permissions issue

5. **Speech Feedback**:
   - Go to `/speech-feedback`
   - Upload or record audio
   - ✅ Should analyze successfully
   - ❌ If error: speech_feedback table issue

6. **Search Function**:
   - Go to `/search`
   - Search for any term
   - ✅ Should return results
   - ❌ If error: documents table permissions

### 2. 🔒 **CRITICAL SECURITY ISSUES** (Fix This Week)

#### Service Role Key Overuse
**Problem**: 97 files reference `SUPABASE_SERVICE_ROLE_KEY`
**Risk**: Service role bypasses ALL security
**Files Most At Risk**:
- `/api/debate/start/route.ts` - Uses service role directly
- `/api/debate/realtime/route.ts` - Bypasses RLS
- `/api/speech-feedback/*` - All endpoints use service role
- `/api/admin/*` - Should use but needs role checking

**Fix Priority**:
1. Replace service role with authenticated client in user-facing APIs
2. Add proper role checking for admin routes
3. Use service role ONLY for system operations

#### Example Fix Pattern:
```typescript
// ❌ BAD - Current pattern in many files
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // Bypasses all security!
);

// ✅ GOOD - Should be this
import { createClient } from '@/utils/supabase/server';
const supabase = createClient(); // Uses user's session
```

### 3. 🗂️ **MIGRATION SYNC ISSUES** (Fix This Month)

**Problem**: Remote database has migrations from April-July 2025
**Evidence**: 
- Local: Last migration is 20250217
- Remote: Has migrations up to 20250703

**Action Required**:
```bash
# 1. Backup current migrations
cp -r supabase/migrations supabase/migrations.backup

# 2. Pull remote schema
npx supabase db pull

# 3. Review new migrations
ls -la supabase/migrations/

# 4. Commit to git
git add supabase/migrations
git commit -m "sync: database migrations with production"
```

### 4. 🎯 **REMAINING ISSUES TO CHECK**

#### Potential RLS Policy Issues
Run `POST_FIX_VERIFICATION.sql` to check for:
- Overly permissive policies (allowing all access)
- Missing user scoping (not checking auth.uid())
- Policies without conditions

#### Environment Variable Issues
- `NEXT_PUBLIC_SITE_URL` vs `NEXT_PUBLIC_APP_URL` inconsistency
- Missing `VERCEL_URL` handling
- Potential CORS issues in production

#### Performance Issues
Now that permissions work, you might see:
- Slow queries (were hidden by service role)
- N+1 query problems
- Missing indexes on foreign keys

### 5. 📊 **MONITORING & VERIFICATION**

#### Check Supabase Dashboard
1. **Auth Logs**: Look for failed signups/logins
2. **Database Logs**: Check for permission denied errors
3. **Edge Functions**: Verify they're running

#### Browser Console Checks
Look for:
- `permission denied for table` - Still permission issues
- `RLS policy violation` - Policy needs adjustment
- `Failed to fetch` - API route errors

#### API Response Checks
- 403 errors = Permission/RLS issues
- 401 errors = Authentication issues
- 500 errors = Server/service role issues

### 6. 🚀 **PRIORITY ORDER**

| Priority | Task | Timeline | Impact |
|----------|------|----------|--------|
| 🔴 P0 | Test auth flow | NOW | Blocks all users |
| 🔴 P0 | Test core features | TODAY | Blocks functionality |
| 🟠 P1 | Remove service role from user APIs | THIS WEEK | Security risk |
| 🟠 P1 | Add admin role checking | THIS WEEK | Security risk |
| 🟡 P2 | Sync migrations | THIS MONTH | Technical debt |
| 🟡 P2 | Audit RLS policies | THIS MONTH | Security hardening |
| 🟢 P3 | Add monitoring | NEXT MONTH | Observability |

### 7. 🔧 **QUICK FIXES FOR COMMON ISSUES**

#### If Login Still Fails:
```sql
-- Ensure user can read their own profile
CREATE POLICY "users_read_own_profile_fix" 
ON user_profiles FOR SELECT 
TO authenticated
USING (auth.uid() = id);
```

#### If Debate Creation Fails:
```sql
-- Check debate_sessions permissions
GRANT ALL ON debate_sessions TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;
```

#### If Search Fails:
```sql
-- Public read on documents
GRANT SELECT ON documents TO anon;
GRANT SELECT ON documents TO authenticated;
```

### 8. 📈 **SUCCESS METRICS**

After all fixes, you should see:
- ✅ 0 "permission denied" errors in logs
- ✅ 0 "authentication_failed" errors
- ✅ All features accessible to logged-in users
- ✅ Service role only in backend/admin routes
- ✅ Proper error messages (not generic)

### 9. 🆘 **TROUBLESHOOTING GUIDE**

| Error | Likely Cause | Fix |
|-------|-------------|-----|
| "permission denied for table X" | Missing GRANT | Run permission fix for that table |
| "authentication_failed" | user_profiles issue | Check INSERT permission |
| "RLS policy violation" | Policy too restrictive | Review policy conditions |
| "Failed to fetch" | API using service role wrong | Check API route auth |
| "CORS error" | Origin mismatch | Check ALLOWED_ORIGINS env |

### 10. 📝 **DOCUMENTATION TO UPDATE**

After fixes are complete, update:
- `README.md` - Remove warnings about auth issues
- `DEPLOYMENT_CHECKLIST.md` - Add permission verification step
- `.env.example` - Clarify which keys are server-only
- `CLAUDE.md` - Update known issues section

---

## 🎯 NEXT IMMEDIATE STEPS

1. **RIGHT NOW**: Test signup/login at `/auth`
2. **If it works**: Test debate creation
3. **If it fails**: Run `POST_FIX_VERIFICATION.sql` and share results
4. **This week**: Start removing service role from user-facing APIs

---

**Status**: Permissions fixed, testing required  
**Risk Level**: Medium (security issues remain)  
**Time to Full Resolution**: 1-2 weeks  

---

*Generated: February 17, 2025*  
*Next Review: After testing completion*