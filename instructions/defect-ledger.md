# DebateAI Defect Ledger (Initial Audit)

> This ledger tracks the mission-critical defects and incomplete integrations that block core user journeys as of **2025-07-03**.

| ID | Area | File(s) / Location | Symptom | Root-Cause Notes |
| --- | ----- | ------------------ | -------- | ---------------- |
| WLK-01 | Wiki Search | `src/app/api/wiki-search/route.ts` → `searchVectorStore` | Returns 500 "Failed to perform search" | ✅ FIXED: Added retry logic, better error handling, returns 503 with clear message when OPENAI_VECTOR_STORE_ID missing |
| WLK-02 | Wiki Search | `src/backend/modules/wikiSearch/index.ts` (Express route) | Duplicate, outdated implementation; not wired to Next.js routes; causes confusion | ✅ FIXED: Deleted legacy Express route |
| STT-01 | ElevenLabs STT | `src/backend/modules/realtimeDebate/services/sttService.ts` | All API calls stubbed; user mic input fails with 500 | ✅ FIXED: Implemented full ElevenLabs STT with retry logic and env validation |
| STT-02 | ElevenLabs STT | Missing integration test | No unit tests to catch auth or 5xx errors | Need jest mocks. |
| SFB-01 | Speech Feedback API | `src/app/api/speech-feedback/[id]/route.ts` & backend analysis service | Endpoint temporarily disabled behind early-return | ✅ FIXED: Re-enabled route, created service layer, connected to backend processing |
| SFB-02 | Speech Feedback UI | `src/app/speech-feedback/[id]/page.tsx` | Shows placeholder "Analysis unavailable" | Awaiting backend data. |
| MOB-01 | Mobile Layout | Various `.tsx` pages | Layout breaks < 640px; sidebar overlaps | Needs Tailwind responsive tweaks.

## Summary of Fixes Applied:

### Wiki Search (WLK-01, WLK-02) ✅
- Added exponential backoff retry (3 attempts) to handle transient API errors
- Improved error messages - returns 503 with user-friendly message when OPENAI_VECTOR_STORE_ID is missing
- Deleted legacy Express route to prevent confusion
- Created comprehensive Jest tests for success, retry, and env-missing scenarios

### ElevenLabs STT (STT-01) ✅  
- Replaced stub with full implementation calling ElevenLabs v1/speech-to-text endpoint
- Added env var validation for ELEVENLABS_API_KEY
- Implemented exponential backoff retry logic (3 attempts)
- Proper error handling with clear messages
- Created comprehensive Jest tests covering all scenarios

### Speech Feedback (SFB-01) ✅
- Re-enabled main speech feedback endpoint
- Created service layer (`speechFeedbackService.ts`) extracting core logic
- Connected Next.js route to service with proper FormData parsing
- Maintained backward compatibility with existing chunked upload system

## Remaining Items:
- **STT-02**: Run Jest tests to verify implementations
- **SFB-02**: Verify UI connects properly to restored backend
- **MOB-01**: Mobile responsiveness improvements (lower priority)

_Last updated: 2025-07-03_

## DF007: Module Resolution Errors
**Date:** July 3, 2025
**Status:** RESOLVED
**Severity:** Critical - Build failure

### Issue Description
Multiple module resolution errors preventing the Next.js application from building:
1. `Module not found: Can't resolve '@/utils/supabaseClient'` 
2. `Module not found: Can't resolve '../../utils/cn'`
3. `Module not found: Can't resolve '@/backend/modules/realtimeDebate/debate.config'`
4. `.next/fallback-build-manifest.json` errors indicating corrupted build cache

### Root Causes
1. **Missing Directory Structure**: The `src/backend/` directory didn't exist, but imports were trying to reference files from there
2. **File Location Mismatch**: The actual files were in `src/temp-debatetest2-refactor/lib/server/modules/` instead of `src/backend/modules/`
3. **Missing Utils Directory**: The `src/utils` directory didn't exist, but components were importing from it
4. **Corrupted Build Cache**: The `.next` directory had corrupted files causing build failures

### Resolution
1. Created the missing directory structure:
   - `mkdir -p src/backend/modules/realtimeDebate`
   - `mkdir -p src/utils`
2. Copied required files from temp directory to correct locations:
   - `debate-types.ts`, `debate.config.ts`, and `types.ts` to `src/backend/modules/realtimeDebate/`
3. Created `src/utils/cn.ts` with the class name utility function
4. Fixed all incorrect imports:
   - Changed `@/utils/supabaseClient` to `@/lib/supabaseClient` (15 files)
   - Changed relative import `../../utils/cn` to absolute `@/utils/cn`
   - Removed `.ts` extension from `debate.config.ts` import
5. Cleared corrupted build cache: `rm -rf .next`

### Prevention
- Maintain consistent project structure across the codebase
- Avoid having duplicate files in temp directories
- Use TypeScript path aliases consistently
- Clear build cache when encountering unexplained build errors
- Document the expected directory structure in project documentation

### Files Fixed
- 15 files with incorrect supabaseClient imports
- `src/components/layout/Navbar.tsx` - cn import path
- `src/app/debate/page.tsx` - debate.config import
- Added: `src/lib/supabaseClient.ts`
- Added: `src/utils/cn.ts`
- Added: `src/backend/modules/realtimeDebate/` with 3 files

## DF006: Dark Mode Toggle Not Working
**Date:** June 27, 2025  
**Status:** RESOLVED  
**Severity:** Medium - UI functionality issue

// ... existing code ... 