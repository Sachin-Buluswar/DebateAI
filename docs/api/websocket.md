# Socket.IO API Reference

> **Status:** ✅ Production Ready

## Overview

Eris Debate uses Socket.IO for real-time, bidirectional communication during debate sessions. This enables:

1. **Real-time State Sync** – All participants see the same debate state
2. **Audio Streaming** – Low-latency audio transmission
3. **Turn Management** – Coordinated speaking turns and interruptions
4. **Session Isolation** – Multiple concurrent debates without interference

## Quick Links

- [Socket.IO Documentation](https://socket.io/docs/v4/)
- [Client API](https://socket.io/docs/v4/client-api/)
- [Server API](https://socket.io/docs/v4/server-api/)

---

## Server Setup

Located in: `src/pages/api/socketio.ts`

```ts
import { Server } from 'socket.io'

const io = new Server(res.socket.server, {
  path: '/api/socketio',
  cors: {
    origin: process.env.NEXT_PUBLIC_APP_URL,
    credentials: true
  },
  maxHttpBufferSize: 1e6,  // 1MB for audio chunks
  pingTimeout: 20000,
  pingInterval: 10000
})

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id)
  
  // Join debate session
  socket.on('join-debate', ({ debateId, userId }) => {
    socket.join(`debate:${debateId}`)
    socket.data.debateId = debateId
    socket.data.userId = userId
  })
})
```

---

## Client Setup

Used in: `src/components/debate/DebateRoom.tsx`

```ts
import { io, Socket } from 'socket.io-client'

const socket: Socket = io({
  path: '/api/socketio',
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000
})

socket.on('connect', () => {
  console.log('Connected to debate server')
})

socket.on('disconnect', (reason) => {
  console.log('Disconnected:', reason)
})
```

---

## Event Reference

### Client → Server Events

| Event | Payload | Description |
|-------|---------|-------------|
| `join-debate` | `{ debateId, userId }` | Join a debate session |
| `leave-debate` | `{ debateId }` | Leave current debate |
| `start-debate` | `{ topic, side }` | Initialize debate with settings |
| `audio-chunk` | `ArrayBuffer` | Stream audio from user |
| `request-turn` | `{ phase }` | Request speaking turn |
| `end-turn` | `{}` | Finish current speaking turn |
| `pause-debate` | `{}` | Pause ongoing debate |
| `resume-debate` | `{}` | Resume paused debate |

### Server → Client Events

| Event | Payload | Description |
|-------|---------|-------------|
| `debate-state` | `DebateState` | Full debate state update |
| `phase-change` | `{ phase, speaker }` | Debate phase transition |
| `audio-stream` | `{ speaker, chunk }` | Audio from AI participants |
| `transcript-update` | `{ speaker, text, isFinal }` | Live transcription |
| `timer-update` | `{ phase, remaining }` | Speaking time remaining |
| `participant-joined` | `{ userId, name }` | New participant notification |
| `participant-left` | `{ userId }` | Participant departure |
| `error` | `{ code, message }` | Error notification |

---

## Debate State Management

### State Structure

```ts
interface DebateState {
  id: string
  topic: string
  phase: DebatePhase
  currentSpeaker: string
  participants: Participant[]
  timer: {
    phase: string
    startTime: number
    duration: number
    isPaused: boolean
  }
  transcript: TranscriptEntry[]
}

enum DebatePhase {
  SETUP = 'setup',
  CONSTRUCTIVE_1 = 'constructive_1',
  CROSSFIRE_1 = 'crossfire_1',
  REBUTTAL = 'rebuttal',
  CROSSFIRE_2 = 'crossfire_2',
  SUMMARY = 'summary',
  FINAL_FOCUS = 'final_focus',
  COMPLETED = 'completed'
}
```

### State Synchronization

```ts
// Server: Broadcast state to all participants
io.to(`debate:${debateId}`).emit('debate-state', currentState)

// Client: Handle state updates
socket.on('debate-state', (state: DebateState) => {
  setDebateState(state)
  updateUI(state)
})
```

---

## Audio Streaming

### Client → Server

```ts
// Convert audio to ArrayBuffer and stream
const audioRecorder = new MediaRecorder(stream)
audioRecorder.ondataavailable = (event) => {
  if (event.data.size > 0) {
    event.data.arrayBuffer().then(buffer => {
      socket.emit('audio-chunk', buffer)
    })
  }
}
```

### Server → Client

```ts
// Server: Relay AI audio to clients
socket.on('ai-audio-ready', ({ speaker, audioBuffer }) => {
  io.to(`debate:${debateId}`).emit('audio-stream', {
    speaker,
    chunk: audioBuffer
  })
})

// Client: Play received audio
socket.on('audio-stream', ({ speaker, chunk }) => {
  audioPlayer.queueChunk(speaker, chunk)
})
```

---

## Room Management

### Namespace Patterns

```ts
// Debate-specific rooms
const debateRoom = `debate:${debateId}`

// User-specific rooms (for private messages)
const userRoom = `user:${userId}`

// Phase-specific rooms (for crossfire participants)
const crossfireRoom = `debate:${debateId}:crossfire`
```

### Session Isolation

```ts
// Ensure messages only go to debate participants
socket.on('send-message', (message) => {
  const { debateId } = socket.data
  if (debateId) {
    io.to(`debate:${debateId}`).emit('new-message', {
      ...message,
      timestamp: Date.now()
    })
  }
})
```

---

## Error Handling

### Connection Errors

```ts
// Client-side reconnection handling
socket.on('connect_error', (error) => {
  console.error('Connection error:', error.message)
  
  if (error.type === 'TransportError') {
    // Network issue - will auto-retry
  } else {
    // Authentication or server error
    showError('Unable to connect to debate server')
  }
})

socket.io.on('reconnect', (attemptNumber) => {
  console.log('Reconnected after', attemptNumber, 'attempts')
  // Rejoin debate room
  socket.emit('join-debate', { debateId, userId })
})
```

### Server-side Validation

```ts
socket.on('start-debate', async (data) => {
  try {
    // Validate user permissions
    const canStart = await validateUserPermissions(socket.data.userId)
    if (!canStart) {
      socket.emit('error', {
        code: 'PERMISSION_DENIED',
        message: 'You cannot start this debate'
      })
      return
    }
    
    // Proceed with debate start
    startDebate(data)
  } catch (error) {
    socket.emit('error', {
      code: 'SERVER_ERROR',
      message: 'Failed to start debate'
    })
  }
})
```

---

## Performance Optimization

### 1. Binary Data for Audio

```ts
// Use binary frames for audio transmission
socket.emit('audio-chunk', audioBuffer)  // Sends as binary

// Avoid JSON serialization for audio
// DON'T: socket.emit('audio', { data: Array.from(buffer) })
```

### 2. Debounce Frequent Updates

```ts
// Debounce transcript updates
const debouncedTranscript = debounce((text) => {
  socket.emit('transcript-update', { text })
}, 100)
```

### 3. Room-based Broadcasting

```ts
// Efficient: Broadcast to room
io.to(`debate:${debateId}`).emit('update', data)

// Inefficient: Send to each socket
participants.forEach(p => {
  io.to(p.socketId).emit('update', data)
})
```

---

## Security Considerations

### Authentication

```ts
// Verify user on connection
io.use(async (socket, next) => {
  const token = socket.handshake.auth.token
  
  try {
    const user = await verifyToken(token)
    socket.data.user = user
    next()
  } catch (err) {
    next(new Error('Authentication failed'))
  }
})
```

### Input Validation

```ts
// Validate all incoming data
socket.on('audio-chunk', (data) => {
  // Check data size
  if (data.byteLength > MAX_CHUNK_SIZE) {
    socket.emit('error', { code: 'CHUNK_TOO_LARGE' })
    return
  }
  
  // Validate audio format
  if (!isValidAudioFormat(data)) {
    socket.emit('error', { code: 'INVALID_AUDIO' })
    return
  }
  
  processAudioChunk(data)
})
```

### Rate Limiting

```ts
const rateLimiter = new Map()

socket.use((event, next) => {
  const key = `${socket.id}:${event[0]}`
  const now = Date.now()
  const limit = rateLimiter.get(key)
  
  if (limit && now - limit.timestamp < 100) {
    limit.count++
    if (limit.count > 10) {
      return next(new Error('Rate limit exceeded'))
    }
  } else {
    rateLimiter.set(key, { timestamp: now, count: 1 })
  }
  
  next()
})
```

---

## Testing & Debugging

### Debug Mode

```ts
// Enable Socket.IO debug logs
localStorage.debug = 'socket.io-client:*'

// Server-side debugging
const io = new Server(server, {
  cors: { origin: '*' }  // Development only!
})

io.on('connection', (socket) => {
  console.log('New connection:', {
    id: socket.id,
    address: socket.handshake.address,
    headers: socket.handshake.headers
  })
})
```

### Common Issues

1. **CORS Errors**: Ensure origin matches exactly
2. **Connection Timeouts**: Check firewall/proxy settings
3. **Message Loss**: Implement acknowledgments for critical events
4. **Memory Leaks**: Clean up listeners on disconnect

```ts
socket.on('disconnect', () => {
  // Clean up resources
  clearInterval(socket.data.timerInterval)
  socket.removeAllListeners()
})
``` 