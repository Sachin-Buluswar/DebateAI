# Eris Debate Production Deployment Checklist

## Pre-Deployment Verification

### ✅ Critical Fixes Applied (Updated August 2025)

#### Original Fixes
- [x] Database infinite recursion in user_roles table FIXED
- [x] MIGRATIONS_API_KEY added to Vercel environment variables
- [x] Authentication routes fixed (/login, /signup redirect to /auth)
- [x] Duplicate navigation links resolved
- [x] Scoring display inconsistencies fixed across all components
- [x] Unified scoring utility created

#### 🔐 NEW Security Fixes (August 2025)
- [x] **Removed all fallback API keys** from `src/shared/env.ts`
- [x] **Secured dangerous endpoints**: `/api/debug` returns 404 in production, `/api/sql` completely disabled
- [x] **Commented out 500+ console.log statements** for production security
- [x] **Fixed all TypeScript compilation errors** - build now compiles successfully
- [x] **Resolved 34 critical ESLint violations** including unused variables
- [x] **Created production environment configuration** (`.env.production`)
- [x] **Implemented proper form validation** with toast notifications instead of browser alerts

### ⚠️ Environment Variables to Verify
Ensure all these are set in Vercel dashboard:
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
OPENAI_API_KEY=
ELEVENLABS_API_KEY=
OPENAI_VECTOR_STORE_ID=
MIGRATIONS_API_KEY=
NEXT_PUBLIC_SITE_URL=https://erisdebate.com
```

## Deployment Steps

### Step 1: Final Code Checks
```bash
# Run these locally before pushing
npm run lint
npm run typecheck
npm run build
```

### Step 2: Commit Changes
```bash
git add .
git commit -m "fix: production readiness updates

- Fixed database infinite recursion
- Added authentication route redirects
- Fixed navigation duplication
- Fixed scoring display inconsistencies
- Added unified scoring utilities"

git push origin feature/add-migrations-auth
```

### Step 3: Deploy to Vercel
1. Go to Vercel dashboard
2. Check deployment preview
3. Test critical flows in preview environment
4. Promote to production if tests pass

## Post-Deployment Testing

### Critical User Flows to Test

#### 1. Authentication Flow
- [ ] User can sign up with email
- [ ] User receives confirmation email with production URL
- [ ] User can log in with email/password
- [ ] User can reset password
- [ ] User can sign in with Google OAuth
- [ ] /login and /signup redirect to /auth properly

#### 2. Core Debate Functionality
- [ ] User can start a new debate
- [ ] Debate participants load correctly
- [ ] User can select topics
- [ ] Speech recording works
- [ ] Real-time features work (or fallback gracefully)
- [ ] Debate history saves correctly

#### 3. Speech Feedback
- [ ] User can submit speech for feedback
- [ ] Audio upload works
- [ ] Feedback generation completes
- [ ] Scores display with correct scale (NSDA/percentage)
- [ ] Feedback can be viewed later

#### 4. Search & Documentation
- [ ] Wiki search returns results
- [ ] Document search works (if documents uploaded)
- [ ] RAG search functions properly

#### 5. UI/UX Verification
- [ ] Navigation works on desktop (sidebar only, no duplicate)
- [ ] Navigation works on mobile (hamburger menu)
- [ ] Dark mode toggle works
- [ ] All pages load without errors
- [ ] Scores show correct scale indicators

## Monitoring & Alerts

### What to Monitor Post-Deployment
1. **Error Rates**
   - Check Vercel logs for 500 errors
   - Monitor Supabase logs for database errors
   - Watch for authentication failures

2. **Performance Metrics**
   - API response times
   - Page load times
   - Time to interactive

3. **User Metrics**
   - Signup success rate
   - Login success rate
   - Debate completion rate
   - Speech feedback generation rate

### Common Issues & Solutions

| Issue | Solution |
|-------|----------|
| Users can't log in | Check user_roles table policies |
| Emails go to spam | Update SPF/DKIM records |
| Slow API responses | Check Supabase connection pooling |
| Audio upload fails | Verify storage bucket permissions |
| Scores show wrong scale | Check scoring utility implementation |

## Rollback Plan

If critical issues are discovered:
1. Revert to previous deployment in Vercel
2. Fix issues in development
3. Re-test thoroughly
4. Deploy again

## Success Criteria

Deployment is successful when:
- ✅ All authentication flows work
- ✅ Users can complete a full debate session
- ✅ Speech feedback generation works
- ✅ No critical errors in logs
- ✅ Performance metrics are acceptable
- ✅ User reports are positive

## Support Contacts

- **Database Issues**: Supabase Dashboard
- **Deployment Issues**: Vercel Support
- **API Issues**: Check respective service dashboards
- **User Reports**: Monitor feedback form submissions

---

## Final Checklist Before Going Live

- [ ] All environment variables verified
- [ ] Database migrations applied successfully
- [ ] Email templates updated with production URLs
- [ ] DNS records properly configured
- [ ] SSL certificate active
- [ ] Monitoring tools configured
- [ ] Backup strategy in place
- [ ] Team notified of deployment

---

**Last Updated**: August 2025
**Status**: ✅ DEPLOYED TO PRODUCTION (August 18, 2025)

## Build Status
- Build: ✅ Successful
- Type Check: ✅ Passing (0 errors)
- Lint: ✅ Passing (0 errors)
- Security: ✅ Centralized auth middleware, no exposed keys
- Database: ✅ All migrations applied
- API Security: ✅ Debug/SQL endpoints disabled in production

## 🔒 Security Verification Checklist
- [x] No hardcoded API keys or secrets in code
- [x] All console.log statements disabled in production
- [x] Debug endpoints return 404 in production
- [x] SQL endpoint completely disabled in production
- [x] Environment variables properly configured
- [x] Error messages don't expose sensitive information
- [x] Rate limiting implemented on API routes
- [x] CORS properly configured for production domain