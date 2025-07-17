# 🚀 DebateAI Production Deployment Checklist

**Last Updated**: 2025-07-17  
**Estimated Time**: ~3 hours (including user configuration)

This checklist must be completed IN ORDER before deploying to production. Each section is organized by priority.

---

## 🔴 CRITICAL - Must Fix Before Deploy (7 minutes)

### 1. ⬜ Fix Hardcoded CORS Origin
**Time**: 5 minutes  
**Impact**: WebSocket connections will fail in production

```typescript
// Location: /src/pages/api/socketio.ts:30
// Current: origin: "http://localhost:3001"
// Fix: Use environment variable
origin: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001"
```

### 2. ⬜ Add Missing Viewport Meta Tag
**Time**: 2 minutes  
**Impact**: Mobile rendering completely broken

```typescript
// Location: src/app/layout.tsx
// Add to <head> section:
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
```

---

## 🟡 HIGH PRIORITY - Security Issues (45 minutes)

### 3. ⬜ Disable Debug Endpoint in Production
**Time**: 15 minutes  
**Impact**: Exposes sensitive system information

```typescript
// Location: /api/debug
// Options:
// 1. Disable completely in production
if (process.env.NODE_ENV === 'production') {
  return NextResponse.json({ error: 'Not found' }, { status: 404 });
}

// 2. Add IP allowlisting
const allowedIPs = process.env.DEBUG_ALLOWED_IPS?.split(',') || [];
if (!allowedIPs.includes(request.ip)) {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}
```

### 4. ⬜ Fix Path Traversal Vulnerability
**Time**: 10 minutes  
**Impact**: Potential directory traversal attack

```typescript
// Location: /backend/modules/speechFeedback/speechFeedbackService.ts
// Fix: Sanitize filenames
import path from 'path';
const safeFilename = path.basename(filename);
```

### 5. ⬜ Generic Auth Error Messages
**Time**: 20 minutes  
**Impact**: Information leakage

```typescript
// Location: /app/auth/callback/route.ts
// Replace detailed errors with generic codes
// Instead of: { error: 'Invalid email or password' }
// Use: { error: 'AUTH_ERROR', code: 'INVALID_CREDENTIALS' }
```

---

## 📋 REQUIRED CONFIGURATION - User Action Needed (30 minutes)

### 6. ⬜ Configure GitHub Repository Secrets

**Navigate to**: Settings → Secrets and variables → Actions → New repository secret

Add these required secrets:

#### Core Application Secrets
- ⬜ `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase project URL
- ⬜ `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anonymous key
- ⬜ `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key
- ⬜ `OPENAI_API_KEY` - OpenAI API key (sk-...)
- ⬜ `ELEVENLABS_API_KEY` - ElevenLabs API key
- ⬜ `OPENAI_VECTOR_STORE_ID` - OpenAI vector store ID (vs_...)

#### Monitoring Secrets
- ⬜ `SENTRY_DSN` - Sentry project DSN
- ⬜ `SENTRY_AUTH_TOKEN` - Sentry authentication token

#### Optional Deployment Secrets
- ⬜ `STAGING_HOST` - Staging server hostname
- ⬜ `STAGING_USER` - SSH username for staging
- ⬜ `STAGING_SSH_KEY` - Private SSH key for staging
- ⬜ `PRODUCTION_HOST` - Production server hostname
- ⬜ `PRODUCTION_USER` - SSH username for production
- ⬜ `PRODUCTION_SSH_KEY` - Private SSH key for production

### 7. ⬜ Configure Supabase Email Templates

Run the interactive setup script:
```bash
npm run setup-emails
```

Configure templates for:
- ⬜ Welcome emails
- ⬜ Password reset emails
- ⬜ Email verification

---

## 🔍 VERIFICATION - Pre-Deployment Tests (30 minutes)

### 8. ⬜ Local Production Build Test
```bash
# Build and run production Docker image
./scripts/docker-build.sh production
./scripts/docker-run.sh production

# Verify:
- ⬜ Application starts without errors
- ⬜ All environment variables are loaded
- ⬜ Health check endpoint responds: http://localhost:3001/api/health
```

### 9. ⬜ Environment Variable Validation
```bash
# Run validation script
npm run check-env

# Manually verify:
- ⬜ All API keys are production keys (not development)
- ⬜ NEXT_PUBLIC_APP_URL points to production domain
- ⬜ NODE_ENV is set to "production"
```

### 10. ⬜ Security Audit
```bash
# Run security checks
npm audit
npm run lint:security

# Verify:
- ⬜ No high/critical vulnerabilities
- ⬜ All dependencies are up to date
- ⬜ Security headers are configured
```

### 11. ⬜ Feature Smoke Tests
Test each core feature locally:
- ⬜ User registration and login
- ⬜ Start a debate with AI
- ⬜ Submit speech and receive feedback
- ⬜ Search wiki for evidence
- ⬜ WebSocket connection stability

---

## 🚀 DEPLOYMENT EXECUTION (20 minutes)

### 12. ⬜ Final Code Review
- ⬜ All changes committed to feature branch
- ⬜ Code review completed
- ⬜ Tests passing in CI

### 13. ⬜ Deploy to Staging (if available)
```bash
# Push to staging branch
git push origin main:staging

# Monitor:
- ⬜ CI/CD pipeline completes successfully
- ⬜ Staging health checks pass
- ⬜ Run smoke tests on staging
```

### 14. ⬜ Deploy to Production
```bash
# Merge to main branch (after approval)
git checkout main
git merge [feature-branch]
git push origin main

# Monitor:
- ⬜ Production CI/CD pipeline
- ⬜ Health check endpoints
- ⬜ Error rates in Sentry
- ⬜ Application logs
```

---

## 📊 POST-DEPLOYMENT VERIFICATION (15 minutes)

### 15. ⬜ Production Health Checks
- ⬜ Main application: https://[your-domain]/
- ⬜ API health: https://[your-domain]/api/health
- ⬜ WebSocket connection test
- ⬜ Database connectivity

### 16. ⬜ Monitor Key Metrics
Check for the first hour:
- ⬜ Error rate < 1%
- ⬜ Response time < 1s
- ⬜ No critical errors in Sentry
- ⬜ All external APIs connecting

### 17. ⬜ User Acceptance Testing
- ⬜ Create a test account
- ⬜ Complete full user journey
- ⬜ Test on mobile devices
- ⬜ Verify email delivery

---

## 🔄 ROLLBACK PLAN

If critical issues occur:

### Immediate Rollback Steps
```bash
# 1. Revert to previous deployment
git revert HEAD
git push origin main

# 2. Or redeploy last known good commit
git checkout [last-good-commit]
git push --force origin main

# 3. Monitor rollback completion
```

### Rollback Checklist
- ⬜ Identify root cause
- ⬜ Document issue in incident report
- ⬜ Notify stakeholders
- ⬜ Plan fix for next deployment

---

## 📝 FINAL NOTES

### Known Limitations
- Mobile UI needs optimization (non-blocking for initial deploy)
- Load testing not yet performed at scale
- Some wiki search features have TODOs

### Support Contacts
- **Technical Issues**: Check logs → Sentry → GitHub Issues
- **Infrastructure**: DevOps team
- **Security Concerns**: Security team

### Next Steps After Deployment
1. Mobile optimization sprint (2-3 days)
2. Load testing and performance tuning
3. A/B testing framework setup
4. Advanced monitoring dashboards

---

**Remember**: This checklist ensures a safe production deployment. Do not skip steps, especially security fixes and configuration requirements.