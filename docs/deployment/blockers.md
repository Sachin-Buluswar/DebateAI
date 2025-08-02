# 🚨 Deployment Blockers - Eris Debate

**Last Updated**: January 2025
**Critical Issues**: 4 (database/storage/env vars/security)
**High Priority**: 3 (security items)
**Setup Required**: Multiple (see CURRENT_TASK_LISTS.md)
**Build Status**: ✅ Builds successfully
**Deployment Status**: ❌ NOT ready - missing critical infrastructure

## 🔴 CRITICAL - Must Fix Before Deploy

### 1. Missing Database Tables
- **Impact**: Search, debates, and documents features completely broken
- **Tables Needed**: `documents`, `document_chunks`, `user_feedback`
- **Fix**: Run SQL scripts in Supabase (see CURRENT_TASK_LISTS.md)
- **Estimated Time**: 45-60 minutes

### 2. Missing Critical Environment Variables
- **Variables**: `ELEVENLABS_CROSSFIRE_AGENT_ID`, `OPENAI_VECTOR_STORE_ID`
- **Impact**: AI debates won't work without agent ID, search broken without vector store
- **Fix**: Get from respective dashboards and add to .env.local
- **Estimated Time**: 20 minutes

### 3. CORS Security Vulnerability
- **Location**: `vercel.json`
- **Current**: Using wildcard `*` for Access-Control-Allow-Origin
- **Fix**: Change to specific domain(s)
- **Impact**: Any website can use your API
- **Estimated Time**: 5 minutes

### 4. Missing Storage Buckets
- **Buckets**: `debate-documents` (public), `debate_audio` (private)
- **Impact**: File uploads and audio recordings will fail
- **Fix**: Create in Supabase or run setup script
- **Estimated Time**: 10 minutes

### ~~Previously Reported (ALREADY FIXED)~~
- ~~CORS origin hardcoded~~ ✅ Actually uses env vars
- ~~Viewport meta missing~~ ✅ Present using Next.js 13+ pattern

## 🟡 HIGH PRIORITY - Security Issues

### 1. Debug Endpoint Exposure
- **Location**: `/api/debug`
- **Current**: Endpoint accessible without restrictions
- **Fix**: Disable in production or add IP allowlisting
- **Impact**: Exposes sensitive system information
- **Estimated Time**: 15 minutes

### 2. Path Traversal Risk
- **Location**: `/backend/modules/speechFeedback/speechFeedbackService.ts`
- **Current**: Unsanitized filename usage
- **Fix**: Sanitize filenames with `path.basename()`
- **Impact**: Potential directory traversal attack
- **Estimated Time**: 10 minutes

### 3. Information Leakage in Auth Errors
- **Location**: `/app/auth/callback/route.ts`
- **Current**: Detailed error messages exposed
- **Fix**: Return generic error codes instead of detailed messages
- **Impact**: Exposes implementation details
- **Estimated Time**: 20 minutes

## 📋 SETUP REQUIRED - User Action

### 1. Configure GitHub Secrets
Required secrets in repository settings:
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
OPENAI_API_KEY
ELEVENLABS_API_KEY
OPENAI_VECTOR_STORE_ID
SENTRY_DSN
SENTRY_AUTH_TOKEN
```

**Instructions**: Settings → Secrets and variables → Actions → New repository secret

### 2. Configure Email Templates
Run the interactive setup:
```bash
npm run setup-emails
```

Follow the prompts to configure Supabase email templates for:
- Welcome emails
- Password reset
- Email verification

## ✅ RESOLVED ISSUES (For Reference)

### Recently Fixed (2025-07-20) - Deployment Session
- ✅ **PDF Parse Module Error** - Fixed critical build failure by using dynamic imports
- ✅ **Supabase Auth Migration** - Migrated from deprecated auth-helpers to @supabase/ssr
- ✅ **Multer Security Update** - Updated to v2.x to fix vulnerabilities
- ✅ **ESLint Prefer-Const** - Fixed all prefer-const warnings

### Previously Fixed (2025-07-20) - Initial Session
- ✅ **TypeScript Compilation Errors** - All type errors fixed, project builds successfully
- ✅ **Logger TypeScript Errors** - Standardized LogContext usage across entire codebase
- ✅ **Missing Dependencies** - Fixed @supabase/auth-helpers-react dependency issue
- ✅ **Sentry Configuration** - Made conditional to avoid build failures
- ✅ **Component Import Errors** - Fixed Toast and other component imports

### Previously Fixed
- ✅ **RLS policies applied** - All user tables now have proper row-level security
- ✅ **WebSocket authentication** - JWT validation implemented
- ✅ **Wiki search authentication** - Admin endpoint now requires auth
- ✅ **Speech feedback API** - Response format fixed
- ✅ **Database schema** - All tables created with proper constraints

## 📊 Deployment Readiness

**Current Status**: 98% feature complete, TypeScript errors resolved, builds successfully

**Time to Production Ready**:
- Critical fixes: ~1 hour (CORS, viewport)
- Security fixes: ~1 hour  
- User setup: ~30 minutes
- **Total**: ~2.5 hours of work + user configuration

**Major Improvement**: Project now compiles without errors and can be deployed to Vercel

## 🚀 Next Steps

1. Fix the two critical issues (CORS and viewport)
2. Address security vulnerabilities
3. User configures GitHub secrets
4. User runs email template setup
5. Deploy to production

Once all items are resolved, this application will be ready for production deployment.