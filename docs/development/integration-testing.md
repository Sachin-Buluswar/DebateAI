# Eris Debate Integration Testing & Fix Plan

## Executive Summary

Based on the identified errors and code analysis, there are significant integration issues between the frontend and backend components. This document provides a comprehensive testing plan and prioritized fixes to restore full functionality.

## Current Integration Issues

### 1. **Speech Feedback API Response Mismatch** 🔴 CRITICAL
**Problem**: Frontend expects `{id: feedbackId}` but backend returns full feedback object with metadata
**Location**: 
- Backend: `/src/app/api/speech-feedback/route.ts` (lines 115-126)
- Frontend: `/src/app/speech-feedback/page.tsx` (lines 475-483)

### 2. **WebSocket Authentication Failure** 🔴 CRITICAL
**Problem**: Socket.IO authentication middleware expects JWT token but client may not be sending it correctly
**Location**:
- Backend: `/src/pages/api/socketio.ts` (lines 43-71)
- Frontend: `/src/app/debate/page.tsx` (lines 131-143)

### 3. **Missing API Endpoints** 🟡 HIGH
**Problem**: Speech feedback chunked upload endpoints referenced but may not exist
**Locations**:
- `/api/speech-feedback/init`
- `/api/speech-feedback/chunk`
- `/api/speech-feedback/finalize`

## Feature Testing Requirements

### 1. Authentication System
- [x] Supabase client configuration
- [ ] Email/password login
- [ ] OAuth providers (if configured)
- [ ] Session persistence
- [ ] Token refresh
- [ ] Protected route access

### 2. Speech Feedback Module
- [ ] Audio file upload (small files <5MB)
- [ ] Audio file upload (large files with chunking)
- [ ] Audio recording functionality
- [ ] Transcription via ElevenLabs
- [ ] GPT-4o feedback generation
- [ ] Feedback storage in database
- [ ] Feedback retrieval and display

### 3. Real-time Debate System
- [ ] WebSocket connection establishment
- [ ] Socket authentication
- [ ] Debate room creation
- [ ] AI personality selection
- [ ] Speech turn management
- [ ] Audio streaming
- [ ] Crossfire mode
- [ ] Debate state persistence
- [ ] Post-debate analysis

### 4. Wiki Search System
- [ ] Vector search initialization
- [ ] Query processing
- [ ] Results retrieval
- [ ] Integration with debate context

## Prioritized Fix Plan

### Phase 1: Critical Fixes (Immediate)

#### Fix 1: Speech Feedback Response Format
```typescript
// In /src/app/api/speech-feedback/route.ts
// Replace lines 115-126 with:
return addSecurityHeaders(
  NextResponse.json({
    id: result.feedbackId,  // Frontend expects this format
    // Optional: Include other data in separate response
    metadata: {
      processingTime: new Date().toISOString(),
      audioUrl: result.audioUrl,
      speechType,
      topic: topic.substring(0, 100)
    }
  }, { status: 200 })
);
```

#### Fix 2: WebSocket Authentication
```typescript
// In /src/app/debate/page.tsx
// Update socket initialization (line 131):
const socket: Socket = io({
  path: '/api/socketio',
  auth: {
    token: session.access_token  // Ensure this is the correct token
  },
  withCredentials: true,  // Add this for cookie support
  // ... rest of config
});
```

### Phase 2: High Priority (Day 1)

#### Fix 3: Implement Missing Chunked Upload Endpoints
Create new file: `/src/app/api/speech-feedback/chunk/route.ts`
```typescript
// Implementation for chunked upload handling
// Store chunks temporarily and reassemble
```

#### Fix 4: Add Error Recovery
- Implement retry logic for failed API calls
- Add connection state management for WebSocket
- Provide user-friendly error messages

### Phase 3: Testing & Validation (Day 2)

#### Testing Checklist:

**Speech Feedback Flow:**
1. [ ] Upload small audio file (<5MB)
2. [ ] Upload large audio file (>5MB)
3. [ ] Record audio and submit
4. [ ] Verify feedback generation
5. [ ] Check feedback display page

**Debate System Flow:**
1. [ ] Create debate with topic
2. [ ] Select AI personalities
3. [ ] Start debate session
4. [ ] Test speech recognition
5. [ ] Verify AI responses
6. [ ] Test crossfire mode
7. [ ] Complete full debate
8. [ ] Review post-debate analysis

**Integration Points:**
1. [ ] Auth token passed to all API calls
2. [ ] WebSocket maintains connection
3. [ ] Audio streaming works both ways
4. [ ] Database operations succeed
5. [ ] File uploads handle errors gracefully

## Testing Steps for Each Fix

### Test 1: Speech Feedback API
```bash
# 1. Start the application
npm run dev

# 2. Login as a test user
# 3. Navigate to /speech-feedback
# 4. Upload a test audio file
# 5. Check browser console for response format
# 6. Verify redirect to feedback page
```

### Test 2: WebSocket Connection
```bash
# 1. Open browser developer tools
# 2. Navigate to /debate
# 3. Check Network tab for WebSocket connection
# 4. Verify authentication headers
# 5. Test debate creation
```

### Test 3: Error Handling
```bash
# 1. Disconnect network briefly
# 2. Attempt file upload
# 3. Verify error message display
# 4. Reconnect and retry
# 5. Confirm recovery
```

## Environment Variables Required

```env
# Verify all are set correctly:
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
OPENAI_API_KEY=
ELEVENLABS_API_KEY=
OPENAI_VECTOR_STORE_ID=
```

## Monitoring & Debugging

### Key Log Points:
1. **API Routes**: Add console.log at start and end of each handler
2. **WebSocket Events**: Log all connection/disconnection events
3. **Database Operations**: Log all Supabase queries
4. **External API Calls**: Log OpenAI/ElevenLabs requests

### Browser Console Commands:
```javascript
// Check auth status
await supabase.auth.getSession()

// Test API directly
fetch('/api/speech-feedback', { method: 'GET' })

// Monitor WebSocket
socket.connected // Should be true
socket.id // Should have value
```

## Success Criteria

A feature is considered working when:
1. ✅ No console errors during operation
2. ✅ Expected data format received
3. ✅ UI updates correctly
4. ✅ Data persists to database
5. ✅ Error cases handled gracefully
6. ✅ Performance is acceptable (<2s response)

## Next Steps

1. **Immediate**: Apply Fix 1 & 2 from Phase 1
2. **Test**: Verify speech feedback and WebSocket connection
3. **Continue**: Proceed with Phase 2 fixes
4. **Document**: Update any changed API contracts
5. **Deploy**: Test in production-like environment

## Notes

- All fixes should maintain backward compatibility
- Add comprehensive error logging for debugging
- Consider adding integration tests for critical paths
- Monitor performance impact of changes
- Keep security considerations in mind (rate limiting, validation)

---

**Status**: Ready for implementation
**Priority**: Critical fixes first, then systematic testing
**Timeline**: 2-3 days for full integration testing and fixes