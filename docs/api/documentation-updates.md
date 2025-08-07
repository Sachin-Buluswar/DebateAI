# API Documentation Updates

## Summary of Changes

### REST API Documentation (`docs/api/rest.md`)

Added missing endpoints that were found in the codebase but not documented:

1. **Wiki & Search Endpoints:**
   - `POST /api/wiki-document-search` - Direct document search in database
   - `POST /api/wiki-rag-search-direct` - Direct RAG search without OpenAI Assistant

2. **Debate Endpoints:**
   - `POST /api/debate/start` - Start a new debate session
   - `POST /api/debate/speech` - Submit a speech during debate
   - `POST /api/debate/end` - End an active debate session
   - `POST /api/debate/realtime` - Real-time debate operations

3. **System Status Endpoints:**
   - `GET /api/search-status` - Check search and document system status
   - `GET /api/rag-status` - Check RAG system status
   - `GET /api/socket-init` - Initialize Socket.IO configuration

4. **Socket.IO Reference:**
   - Added reference to Socket.IO endpoint at `/api/socketio`
   - Added note about Vercel deployment limitations

### WebSocket API Documentation (`docs/api/websocket.md`)

Updated to reflect the actual Socket.IO implementation:

1. **Server Setup:**
   - Updated configuration to match actual implementation
   - Added authentication middleware details
   - Noted Vercel transport limitations (polling-only)

2. **Events:**
   - Updated client→server events to match actual implementation:
     - `startDebate`, `pauseDebate`, `resumeDebate`, `skipTurn`
     - `saveDebate`, `loadDebate`
     - `userCrossfireAudio`, `userSpeech`
   - Updated server→client events:
     - `debateStateUpdate`, `aiSpeech`, `aiAudio`
     - `crossfireAudio`, `debateAnalysis`
     - `speakerChange`, `phaseChange`

3. **State Structure:**
   - Updated `DebateState` interface to match implementation
   - Updated `DebatePhase` enum with actual phase names
   - Added `Participant` interface

4. **Session Management:**
   - Documented database integration
   - Added session and transcript tracking
   - Documented speech saving functionality

5. **Authentication:**
   - Updated to show Supabase JWT authentication
   - Added development mode anonymous access
   - Showed proper token extraction methods

## Verification

All documented endpoints have been verified to exist in the codebase at:
- REST API routes: `src/app/api/*/route.ts`
- Socket.IO handler: `src/pages/api/socketio.ts`
- Socket manager: `src/backend/modules/realtimeDebate/SocketManager.ts`

The documentation now accurately reflects the current implementation.