# REST API Documentation

## Overview

The Eris Debate platform provides a comprehensive REST API for all client-server interactions. All endpoints follow RESTful conventions and return JSON responses.

## Base URL

- Development: `http://localhost:3001/api`
- Production: `https://api.erisdebate.com/api`

## Authentication

Most endpoints require authentication via Supabase Auth. Include the JWT token in the Authorization header:

```
Authorization: Bearer <JWT_TOKEN>
```

## Rate Limiting

All endpoints implement rate limiting. Rate limit information is included in response headers:
- `X-RateLimit-Limit`: Maximum requests allowed
- `X-RateLimit-Remaining`: Requests remaining
- `X-RateLimit-Reset`: Unix timestamp when the limit resets

## Common Response Format

### Success Response
```json
{
  "success": true,
  "data": { ... },
  "timestamp": "2025-07-17T12:00:00Z"
}
```

### Error Response
```json
{
  "error": "Error message",
  "details": "Additional error details",
  "status": 400
}
```

---

## Endpoints

### Health & Monitoring

#### GET /api/health
System health check endpoint.

**Response:**
```json
{
  "uptime": 1234.56,
  "message": "OK",
  "timestamp": 1234567890,
  "checks": {
    "env": "OK"
  }
}
```

#### GET /api/health_check
Alternative health check endpoint.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-07-17T12:00:00Z"
}
```

#### GET /api/monitoring/health
Detailed monitoring health check.

**Response:**
```json
{
  "status": "healthy",
  "services": {
    "database": "healthy",
    "openai": "healthy",
    "elevenlabs": "healthy"
  }
}
```

#### GET /api/monitoring/metrics
System metrics and performance data.

**Response:**
```json
{
  "metrics": {
    "requests": 1000,
    "avgResponseTime": 150,
    "activeUsers": 25
  }
}
```

### Authentication

#### POST /api/auth-email-templates
Customize email templates for authentication flows.

**Request Body:**
```json
{
  "templateType": "welcome|verification|reset",
  "subject": "Email subject",
  "content": "Email HTML content"
}
```

### User Management

#### GET /api/user_profiles
Get user profile information.

**Authentication:** Required

**Response:**
```json
{
  "id": "user-id",
  "email": "user@example.com",
  "profile": {
    "displayName": "User Name",
    "avatar": "url-to-avatar"
  }
}
```

#### POST /api/user_profiles
Update user profile.

**Authentication:** Required

**Request Body:**
```json
{
  "displayName": "New Name",
  "avatar": "new-avatar-url"
}
```

#### GET /api/user_preferences
Get user preferences.

**Authentication:** Required

**Response:**
```json
{
  "theme": "light|dark",
  "notifications": true,
  "defaultDebateFormat": "public-forum"
}
```

#### POST /api/user_preferences
Update user preferences.

**Authentication:** Required

**Request Body:**
```json
{
  "theme": "dark",
  "notifications": false
}
```

### Debate Features

#### POST /api/debate/start
Start a new debate session.

**Authentication:** Required

**Request Body:**
```json
{
  "topic": "Universal Basic Income",
  "userSide": "PRO",
  "userId": "user-123-uuid",
  "debaters": ["ai-opponent"]
}
```

**Response:**
```json
{
  "success": true,
  "sessionId": "session-456-uuid",
  "topic": "Universal Basic Income",
  "userSide": "PRO",
  "status": "active"
}
```

#### POST /api/debate/speech
Submit a speech during a debate.

**Authentication:** Required

**Request Body:**
```json
{
  "sessionId": "session-456-uuid",
  "speakerId": "user-123-uuid",
  "text": "My argument is that UBI provides economic security...",
  "side": "PRO",
  "timestamp": "2025-07-17T12:00:00Z"
}
```

**Response:**
```json
{
  "success": true,
  "speechId": "speech-789-uuid",
  "saved": true
}
```

#### POST /api/debate/end
End an active debate session.

**Authentication:** Required

**Request Body:**
```json
{
  "sessionId": "session-456-uuid",
  "winner": "PRO",
  "reason": "User requested to end debate"
}
```

**Response:**
```json
{
  "success": true,
  "sessionId": "session-456-uuid",
  "status": "completed",
  "winner": "PRO"
}
```

#### POST /api/debate/realtime
Real-time debate operations (start/join).

**Authentication:** Required

**Request Body (Start):**
```json
{
  "action": "start",
  "debateId": "debate-123-uuid",
  "topic": "Climate Change",
  "participants": [
    {
      "id": "user-123",
      "name": "John Doe",
      "isAI": false,
      "team": "PRO",
      "role": "Speaker 1"
    }
  ]
}
```

**Request Body (Join):**
```json
{
  "action": "join",
  "debateId": "debate-123-uuid",
  "userId": "user-456"
}
```

#### POST /api/debate/analyze
Analyze a completed debate and provide feedback.

**Authentication:** Required

**Request Body:**
```json
{
  "transcript": [
    {
      "participantId": "user-123",
      "participantName": "John Doe",
      "content": "Speech content..."
    }
  ],
  "userParticipantId": "user-123",
  "debateTopic": "Climate Change Policy",
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

#### POST /api/debate-advice
Get strategic advice during a debate.

**Authentication:** Required

**Request Body:**
```json
{
  "topic": "Climate Change Policy",
  "position": "pro|con",
  "currentArguments": ["argument1", "argument2"],
  "opponentArguments": ["counter1", "counter2"]
}
```

### Speech Feedback

#### POST /api/speech-feedback
Submit audio for speech analysis and feedback.

**Authentication:** Required

**Content-Type:** multipart/form-data

**Form Data:**
- `audio`: Audio file (max 50MB, formats: mp3, wav, webm, m4a)
- `topic`: Debate topic
- `speechType`: Type of speech (debate, presentation, etc.)
- `userSide`: User's position (pro/con)
- `customInstructions`: Optional custom analysis instructions
- `userId`: User ID

**Response:**
```json
{
  "id": "feedback-id",
  "success": true
}
```

#### POST /api/speech-feedback/init
Initialize a chunked speech feedback session.

**Authentication:** Required

**Request Body:**
```json
{
  "topic": "Climate Change",
  "speechType": "debate",
  "userSide": "pro",
  "customInstructions": "Focus on argument structure"
}
```

**Response:**
```json
{
  "sessionId": "session-123",
  "uploadUrl": "/api/speech-feedback/chunk"
}
```

#### POST /api/speech-feedback/chunk
Upload audio chunks for streaming feedback.

**Authentication:** Required

**Request Body:**
```json
{
  "sessionId": "session-123",
  "chunkIndex": 0,
  "chunk": "base64-encoded-audio",
  "isLastChunk": false
}
```

#### POST /api/speech-feedback/finalize
Finalize chunked upload and get feedback.

**Authentication:** Required

**Request Body:**
```json
{
  "sessionId": "session-123"
}
```

#### POST /api/speech-feedback/cancel
Cancel an ongoing speech feedback session.

**Authentication:** Required

**Request Body:**
```json
{
  "sessionId": "session-123"
}
```

### Wiki & Search

#### POST /api/wiki-search
Search Wikipedia content using semantic search.

**Request Body:**
```json
{
  "query": "climate change effects",
  "maxResults": 10
}
```

**Response:**
```json
{
  "results": [
    {
      "title": "Climate Change",
      "snippet": "Climate change refers to...",
      "url": "https://en.wikipedia.org/wiki/Climate_change",
      "score": 0.95
    }
  ]
}
```

#### POST /api/wiki-document-search
Direct document search in the database for document chunks with context.

**Request Body:**
```json
{
  "query": "climate policy arguments",
  "maxResults": 10
}
```

**Response:**
```json
{
  "success": true,
  "results": [
    {
      "id": "chunk-123",
      "content": "Document chunk content...",
      "pageNumber": 5,
      "sectionTitle": "Policy Arguments",
      "document": {
        "title": "Climate Policy Review",
        "fileName": "climate_policy_2024.pdf"
      }
    }
  ]
}
```

#### POST /api/wiki-rag-search
Pure RAG (Retrieval-Augmented Generation) search with vector embeddings.

**Request Body:**
```json
{
  "query": "climate change policy debates",
  "maxResults": 10
}
```

**Response:**
```json
{
  "success": true,
  "searchType": "rag",
  "results": [
    {
      "content": "Document chunk content...",
      "source": "Climate_Policy.pdf",
      "score": 0.92,
      "metadata": {
        "file_id": "file_123",
        "file_name": "Climate_Policy.pdf",
        "chunk_index": 5,
        "page_number": 12
      }
    }
  ],
  "query": "climate change policy debates",
  "timestamp": "2025-07-17T12:00:00Z"
}
```

#### POST /api/wiki-rag-search-direct
Direct RAG search from database without OpenAI Assistant.

**Request Body:**
```json
{
  "query": "renewable energy debate points",
  "maxResults": 10
}
```

**Response:**
```json
{
  "success": true,
  "searchType": "rag-direct",
  "results": [
    {
      "id": "chunk-456",
      "content": "Renewable energy arguments...",
      "pageNumber": 3,
      "sectionTitle": "Economic Benefits",
      "document": {
        "title": "Renewable Energy Debates",
        "fileName": "renewable_energy.pdf"
      }
    }
  ]
}
```

#### POST /api/wiki-rag-search-enhanced
Enhanced RAG search with AI-powered synthesis.

**Request Body:**
```json
{
  "query": "What are the main arguments in climate debates?",
  "maxResults": 5,
  "synthesize": true
}
```

**Response:**
```json
{
  "success": true,
  "searchType": "rag-enhanced",
  "synthesis": "Based on the documents, the main arguments include...",
  "sources": [
    {
      "content": "Source content...",
      "metadata": { ... }
    }
  ]
}
```

#### POST /api/wiki-generate
Generate Wikipedia-style content on a topic.

**Request Body:**
```json
{
  "topic": "Renewable Energy Debates",
  "sections": ["overview", "arguments", "evidence"]
}
```

#### POST /api/wiki-index
Index new content into the vector store.

**Authentication:** Required (Admin only)

**Request Body:**
```json
{
  "content": "Content to index...",
  "metadata": {
    "source": "document.pdf",
    "category": "climate"
  }
}
```

### Prototype/Development Endpoints

#### POST /api/prototype/openai-argument
Generate debate arguments using OpenAI.

**Request Body:**
```json
{
  "topic": "Universal Basic Income",
  "position": "pro",
  "style": "analytical"
}
```

#### POST /api/prototype/elevenlabs-tts
Convert text to speech using ElevenLabs.

**Request Body:**
```json
{
  "text": "This is a test speech.",
  "voiceId": "voice-123"
}
```

### Admin Endpoints

#### POST /api/admin/upload-document
Upload documents for indexing.

**Authentication:** Required (Admin only)

**Content-Type:** multipart/form-data

**Form Data:**
- `document`: PDF/TXT file
- `category`: Document category
- `metadata`: JSON metadata

#### POST /api/admin/reindex-document
Reindex an existing document.

**Authentication:** Required (Admin only)

**Request Body:**
```json
{
  "documentId": "doc-123",
  "forceReindex": true
}
```

#### POST /api/admin/scrape-opencaselist
Scrape debate evidence from OpenCaseList.

**Authentication:** Required (Admin only)

**Request Body:**
```json
{
  "topic": "Climate Policy",
  "year": "2024-2025",
  "limit": 100
}
```

#### GET /api/admin/scrape-status
Check scraping job status.

**Authentication:** Required (Admin only)

**Response:**
```json
{
  "jobId": "job-123",
  "status": "running|completed|failed",
  "progress": 75,
  "documentsProcessed": 150
}
```

### System Status & Monitoring

#### GET /api/search-status
Check the status of the search and document systems.

**Response:**
```json
{
  "timestamp": "2025-07-17T12:00:00Z",
  "database": {
    "connected": true,
    "documents": 150,
    "chunks": 3500,
    "indexedDocuments": 150
  },
  "storage": {
    "bucketExists": true,
    "fileCount": 150
  },
  "search": {
    "documentSearchEnabled": true,
    "fullTextEnabled": true,
    "trigramEnabled": true,
    "indexesCreated": true,
    "aiAssistantEnabled": true
  },
  "configuration": {
    "supabaseUrl": true,
    "supabaseKey": true,
    "openaiKey": true,
    "vectorStoreId": true
  }
}
```

#### GET /api/rag-status
Check the status of the RAG (Retrieval-Augmented Generation) system.

**Response:**
```json
{
  "timestamp": "2025-07-17T12:00:00Z",
  "database": {
    "connected": true,
    "documents": 150,
    "chunks": 3500,
    "indexedDocuments": 150
  },
  "storage": {
    "bucketExists": true,
    "fileCount": 150
  },
  "search": {
    "fullTextEnabled": true,
    "trigramEnabled": true,
    "indexesCreated": true
  },
  "configuration": {
    "supabaseUrl": true,
    "supabaseKey": true,
    "openaiKey": true,
    "vectorStoreId": true
  }
}
```

#### GET /api/socket-init
Initialize Socket.IO configuration and check transport support.

**Response:**
```json
{
  "status": "ok",
  "environment": {
    "isVercel": false,
    "nodeEnv": "development",
    "transport": "websocket-polling",
    "limitations": []
  },
  "socketConfig": {
    "path": "/api/socketio",
    "transports": ["polling", "websocket"],
    "upgrade": true
  },
  "timestamp": "2025-07-17T12:00:00Z"
}
```

### Debugging & Development

#### GET /api/debug
Debug endpoint for development (requires DEBUG_API_KEY header).

**Headers:**
```
x-api-key: <DEBUG_API_KEY>
```

**Response:**
```json
{
  "environment": "development",
  "version": "1.0.0",
  "services": {
    "database": "connected",
    "openai": "configured",
    "elevenlabs": "configured"
  }
}
```

#### POST /api/sql
Execute SQL queries (development only).

**Authentication:** Required (Admin only)

**Request Body:**
```json
{
  "query": "SELECT * FROM users LIMIT 10",
  "params": []
}
```

#### POST /api/migrations
Run database migrations.

**Authentication:** Required (Admin only)

**Request Body:**
```json
{
  "direction": "up|down",
  "target": "latest|specific-version"
}
```

#### GET /api/example-monitored
Example endpoint demonstrating monitoring integration.

**Response:**
```json
{
  "message": "This endpoint is monitored",
  "traceId": "trace-123",
  "metrics": {
    "responseTime": 45
  }
}
```

## Error Codes

| Status Code | Description |
|------------|-------------|
| 200 | Success |
| 400 | Bad Request - Invalid input |
| 401 | Unauthorized - Authentication required |
| 403 | Forbidden - Insufficient permissions |
| 404 | Not Found |
| 413 | Payload Too Large |
| 429 | Too Many Requests - Rate limit exceeded |
| 500 | Internal Server Error |
| 503 | Service Unavailable |

## Security Headers

All responses include security headers:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Strict-Transport-Security: max-age=31536000`

## CORS Configuration

CORS is configured per environment:
- Development: `Access-Control-Allow-Origin: *`
- Production: `Access-Control-Allow-Origin: https://erisdebate.com`

## Socket.IO Endpoint

The Socket.IO server is available at `/api/socketio`. For detailed real-time API documentation, see the [WebSocket API documentation](./websocket.md).

**Note on Vercel Deployment:** When deployed to Vercel, WebSocket connections are not supported due to serverless function limitations. The system automatically falls back to HTTP long-polling, which may result in slightly increased latency but maintains full functionality.