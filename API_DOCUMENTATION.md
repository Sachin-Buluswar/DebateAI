# Eris Debate API Documentation

## Overview

The Eris Debate application provides a comprehensive set of REST API endpoints for debate management, speech feedback, document search, and system administration. All endpoints follow consistent patterns for authentication, rate limiting, error handling, and security.

## Base URL

- Development: `http://localhost:3001/api`
- Production: `https://erisdebate.com/api` or configured domain

## Common Patterns

### Authentication

Most endpoints require authentication via Supabase Auth:
- Session-based authentication using cookies
- Bearer token authentication via `Authorization` header
- Some admin endpoints require additional role-based access control (RBAC)

### Rate Limiting

All endpoints implement rate limiting with different tiers:
- `apiRateLimiter`: General API endpoints (100 requests/15 minutes)
- `debateRateLimiter`: Debate-related endpoints (50 requests/15 minutes)
- `speechFeedbackRateLimiter`: Speech upload endpoints (10 requests/15 minutes)
- `wikiSearchRateLimiter`: Search endpoints (100 requests/15 minutes)

### Error Response Format

```json
{
  "error": "Human-readable error message",
  "details": ["Validation field errors (optional, 400 responses only)"]
}
```

### Security Headers

All responses include security headers:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Content-Security-Policy` (restrictive policy)

## Endpoints

### Health Check Endpoints

#### GET `/api/health`
Basic health check with environment variable validation.

**Response:**
```json
{
  "uptime": 12345,
  "message": "OK",
  "timestamp": 1234567890,
  "checks": {
    "env": "OK"
  }
}
```

#### GET `/api/health_check`
Comprehensive health check with Supabase connectivity test.

**Response:**
```json
{
  "status": "success",
  "message": "Successfully connected to Supabase",
  "health_check": "table exists",
  "user_profiles": "found 5 records"
}
```

#### GET `/api/monitoring/health`
Advanced health monitoring with dependency checks.

**Features:**
- Checks Supabase, OpenAI, and ElevenLabs connectivity
- Measures response times
- Reports resource usage
- Returns overall health status

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00Z",
  "version": "0.1.0",
  "environment": "production",
  "uptime": 3600,
  "checks": [
    {
      "service": "supabase",
      "status": "healthy",
      "responseTime": 120
    }
  ],
  "resources": {
    "memory": {
      "used": 104857600,
      "total": 536870912,
      "percentage": 19.5
    }
  }
}
```

### Authentication & User Management

#### GET/POST `/api/user_profiles`
Manage user profile data.

**GET Query Parameters:**
- `limit`: Number of profiles to return (default: 10)
- `userId`: Filter by specific user ID

**POST Body:**
```json
{
  "user_id": "uuid",
  "display_name": "John Doe",
  "preferences": {
    "theme": "dark",
    "notifications": true
  }
}
```

### Debate Management

#### POST `/api/debate/start`
Initialize a new debate session.

**Request Body:**
```json
{
  "topic": "Debate topic",
  "userSide": "PRO",
  "userId": "user-uuid",
  "debaters": ["debater1", "debater2"] // optional
}
```

**Response:**
```json
{
  "success": true,
  "sessionId": "session-uuid",
  "message": "Debate session created. Connect via WebSocket for real-time interaction."
}
```

#### POST `/api/debate/speech`
Record a speech in an active debate.

**Request Body:**
```json
{
  "sessionId": "session-uuid",
  "speakerId": "speaker-uuid",
  "text": "Speech content",
  "side": "PRO",
  "timestamp": "2024-01-01T00:00:00Z" // optional
}
```

#### POST `/api/debate/analyze`
Generate AI-powered analysis of a debate transcript.

**Request Body:**
```json
{
  "transcript": [
    {
      "participantId": "id",
      "participantName": "Name",
      "content": "Speech content"
    }
  ],
  "userParticipantId": "user-id",
  "debateTopic": "Topic",
  "debateFormat": "Public Forum"
}
```

**Response:**
```json
{
  "success": true,
  "analysis": "**Debate Summary:** ...\n\n**Winner Declaration:** ...\n\n**Personalized Feedback:** ..."
}
```

#### POST `/api/debate/end`
End an active debate session.

**Request Body:**
```json
{
  "sessionId": "session-uuid",
  "winner": "PRO", // optional: PRO, CON, or DRAW
  "reason": "End reason" // optional
}
```

#### POST/GET `/api/debate/realtime`
Manage real-time debate sessions using Supabase Realtime.

**POST Actions:**
- `/start`: Initialize a debate with participants
- `/join`: Join an existing debate
- `/end`: End a debate session

### Speech Feedback

#### POST `/api/speech-feedback`
Upload audio for speech analysis.

**Request:** Multipart form data
- `audio`: Audio file (MP3, WAV, etc., max 50MB)
- `topic`: Debate topic
- `speechType`: Type of speech
- `userSide`: PRO or CON
- `customInstructions`: Custom analysis instructions (optional)
- `userId`: User identifier

**Response:**
```json
{
  "id": "feedback-id",
  "success": true
}
```

#### POST `/api/speech-feedback/init`
Initialize chunked upload session for large audio files.

**Request Body:**
```json
{
  "filename": "speech.mp3",
  "contentType": "audio/mpeg",
  "totalSize": 10485760,
  "totalChunks": 5,
  "sessionId": "session-id",
  "userId": "user-id",
  "topic": "Debate topic",
  "speechType": "constructive",
  "userSide": "PRO",
  "customInstructions": "Focus on delivery"
}
```

#### POST `/api/speech-feedback/chunk`
Upload a chunk of audio data.

**Request:** Multipart form data
- `chunk`: File chunk
- `sessionId`: Upload session ID
- `chunkIndex`: Chunk index (0-based)
- `finalChunk`: "true" if last chunk

#### POST `/api/speech-feedback/finalize`
Finalize chunked upload and trigger processing.

**Request Body:**
```json
{
  "sessionId": "session-id"
}
```

#### DELETE `/api/speech-feedback/cancel`
Cancel an in-progress upload session.

**Query Parameters:**
- `sessionId`: Session to cancel

### Document Search & Wiki

#### POST `/api/wiki-search`
Search the vector store for relevant documents.

**Request Body:**
```json
{
  "query": "search query",
  "maxResults": 5
}
```

**Response:**
```json
{
  "success": true,
  "results": [
    {
      "content": "Document content",
      "metadata": {
        "source": "document.pdf",
        "page": 5
      },
      "relevanceScore": 0.95
    }
  ],
  "query": "search query",
  "maxResults": 5,
  "timestamp": "2024-01-01T00:00:00Z",
  "cached": false
}
```

#### POST `/api/wiki-document-search`
Search within specific documents.

#### POST `/api/wiki-generate`
Generate debate content based on wiki knowledge.

### Admin Endpoints

All admin endpoints require authentication and admin role via RBAC.

#### POST `/api/admin/upload-document`
Upload documents to the knowledge base.

**Request:** Multipart form data
- `file`: PDF or TXT file

**Headers:**
- `Authorization: Bearer {token}`

**Response:**
```json
{
  "success": true,
  "documentId": "doc-id",
  "fileName": "document.pdf"
}
```

#### POST `/api/admin/scrape-opencaselist`
Scrape documents from OpenCaseList.

#### GET `/api/admin/scrape-status`
Check scraping job status.

#### POST `/api/admin/reindex-document`
Reindex a document in the vector store.

### System Utilities

#### ~~POST `/api/migrations`~~ (DISABLED)
**Status**: ⛔ **PERMANENTLY DISABLED FOR SECURITY**

This endpoint has been disabled in production for security reasons. Database migrations should be executed directly through the Supabase dashboard or CI/CD pipeline.

**Previous Purpose**: Execute database migrations
**Reason for Disabling**: Security risk - potential for unauthorized database modifications
**Alternative**: Use Supabase dashboard SQL editor or migration tools

#### ~~POST `/api/sql`~~ (DISABLED)
**Status**: ⛔ **PERMANENTLY DISABLED FOR SECURITY**

This endpoint has been disabled in production for security reasons. Direct SQL execution through API endpoints poses significant security risks.

**Previous Purpose**: Execute raw SQL queries
**Reason for Disabling**: Critical security risk - SQL injection, data exposure
**Alternative**: Use Supabase dashboard for administrative SQL queries match

### Monitoring & Metrics

#### GET `/api/monitoring/metrics`
Prometheus-compatible metrics endpoint.

**Response:** Prometheus text format metrics including:
- HTTP request counts and durations
- Active connections
- Error rates
- Custom business metrics

### Educational Resources

#### GET `/api/resources`
Retrieve educational resources and learning materials.

**Response:**
```json
{
  "resources": [
    {
      "id": "string",
      "title": "string",
      "description": "string",
      "category": "string",
      "difficulty": "beginner|intermediate|advanced",
      "content": "string",
      "slug": "string"
    }
  ]
}
```

#### GET `/api/resources/[slug]`
Retrieve a specific educational resource by its slug.

**Parameters:**
- `slug`: Resource identifier

**Response:**
```json
{
  "resource": {
    "id": "string",
    "title": "string",
    "content": "string",
    "metadata": {}
  }
}
```

#### POST `/api/resources/track`
Track user interaction with educational resources.

**Request Body:**
```json
{
  "resourceId": "string",
  "action": "view|complete|bookmark",
  "metadata": {}
}
```

#### GET `/api/debug` (Development Only)
**Status**: ⛔ **Returns 404 in production**

Debug endpoint for development troubleshooting. Automatically disabled in production environments.

### Additional Search Endpoints

#### POST `/api/wiki-generate`
Generate wiki-style content based on a prompt.

**Request Body:**
```json
{
  "prompt": "string",
  "context": "string (optional)",
  "maxTokens": 500
}
```

#### GET `/api/debate-advice`
Get AI-generated debate advice and strategies.

**Query Parameters:**
- `topic`: Debate topic
- `position`: pro/con
- `level`: novice/intermediate/advanced

**Response:**
```json
{
  "advice": {
    "strategy": "string",
    "keyPoints": ["string"],
    "anticipatedCounterarguments": ["string"],
    "suggestedEvidence": ["string"]
  }
}
```

#### DELETE `/api/admin/delete-document`
Delete a document and all associated data (chunks, storage file).

**Request Body:**
```json
{
  "documentId": "uuid"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Document filename.pdf deleted successfully"
}
```

## WebSocket Support

### Socket.IO Integration

The application uses Socket.IO for real-time features:
- Endpoint: `/api/socketio`
- Transport: WebSocket with HTTP long-polling fallback
- CORS configuration required

### Supabase Realtime

For Vercel deployments, Supabase Realtime channels are used:
- Channel pattern: `debate:{debateId}`
- Events: `debate_initialized`, `debate_ended`, etc.

## Error Handling

### Common Error Codes

- `400`: Bad Request - Invalid input or validation failure
- `401`: Unauthorized - Missing or invalid authentication
- `403`: Forbidden - Insufficient permissions
- `404`: Not Found - Resource doesn't exist
- `413`: Payload Too Large - File size exceeds limit
- `429`: Too Many Requests - Rate limit exceeded
- `500`: Internal Server Error - Server-side error
- `503`: Service Unavailable - Temporary outage

### Validation Errors

Validation errors include detailed field-level information:
```json
{
  "error": "Invalid request data",
  "details": {
    "fieldName": ["Validation error message"]
  }
}
```

## Best Practices

### Request Guidelines

1. Always include appropriate authentication headers
2. Use correct content types (application/json, multipart/form-data)
3. Respect rate limits and implement exponential backoff
4. Handle errors gracefully with user-friendly messages

### Security Considerations

1. Never expose sensitive data in responses
2. Sanitize all user inputs
3. Use HTTPS in production
4. Implement proper CORS policies
5. Validate file uploads thoroughly

### Performance Tips

1. Use pagination for list endpoints
2. Implement client-side caching where appropriate
3. Use chunked uploads for large files
4. Monitor rate limit headers in responses

## Environment Variables

Required environment variables for API functionality:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# OpenAI
OPENAI_API_KEY=
OPENAI_VECTOR_STORE_ID=

# ElevenLabs
ELEVENLABS_API_KEY=

# Security
MIGRATIONS_API_KEY=
ADMIN_SQL_KEY=
ENABLE_SQL_ENDPOINT=

# Optional
MIGRATIONS_ALLOWED_IPS=
NEXT_PUBLIC_APP_URL=
VERCEL_URL= # Auto-set by Vercel
```

## Integration Examples

### JavaScript/TypeScript

```typescript
// Authenticated request example
const response = await fetch('/api/wiki-search', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    query: 'debate strategies',
    maxResults: 10
  })
});

const data = await response.json();
```

### File Upload

```typescript
// Chunked upload example
const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB chunks
const file = fileInput.files[0];
const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

// Initialize session
const initResponse = await fetch('/api/speech-feedback/init', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    filename: file.name,
    contentType: file.type,
    totalSize: file.size,
    totalChunks,
    sessionId: generateSessionId(),
    // ... other metadata
  })
});

// Upload chunks
for (let i = 0; i < totalChunks; i++) {
  const chunk = file.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
  const formData = new FormData();
  formData.append('chunk', chunk);
  formData.append('sessionId', sessionId);
  formData.append('chunkIndex', i.toString());
  formData.append('finalChunk', (i === totalChunks - 1).toString());
  
  await fetch('/api/speech-feedback/chunk', {
    method: 'POST',
    body: formData
  });
}

// Finalize
await fetch('/api/speech-feedback/finalize', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ sessionId })
});
```