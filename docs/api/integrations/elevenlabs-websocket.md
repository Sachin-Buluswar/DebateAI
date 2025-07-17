# ElevenLabs WebSocket Streaming Documentation

## Overview

The ElevenLabs WebSocket streaming implementation provides lower-latency audio generation by streaming audio chunks in real-time rather than waiting for the entire audio file to be generated.

## Features

- **Real-time streaming**: Audio chunks are sent to the client as they're generated
- **Automatic fallback**: Falls back to HTTP API if WebSocket fails
- **Reconnection logic**: Automatically attempts to reconnect on disconnection
- **Error recovery**: Comprehensive error handling with retry logic
- **Message queueing**: Queues messages when disconnected and sends when reconnected

## Configuration

### Environment Variables

To enable WebSocket streaming, set the following environment variable:

```bash
ELEVENLABS_WEBSOCKET_ENABLED=true
```

When not set or set to `false`, the system will use the traditional HTTP API.

### API Configuration

The WebSocket service uses the same configuration as the HTTP API:
- Voice IDs from debate personalities
- Model ID from services config
- API key from ELEVENLABS_API_KEY environment variable

## Implementation Details

### Server-Side (Backend)

1. **WebSocket Service** (`src/backend/services/elevenLabsWebSocket.ts`)
   - Manages WebSocket connection to ElevenLabs
   - Handles authentication and connection lifecycle
   - Processes audio chunks and errors
   - Implements reconnection logic

2. **TTS Service Integration** (`src/backend/services/ttsService.ts`)
   - `generateAudioStreamWebSocket()` function for WebSocket streaming
   - `shouldUseWebSocket()` helper to determine streaming method
   - Maintains backward compatibility with HTTP API

3. **Socket Manager Updates** (`src/backend/modules/realtimeDebate/SocketManager.ts`)
   - Checks if WebSocket streaming is enabled
   - Emits audio chunks as they arrive
   - Falls back to HTTP on WebSocket failure
   - Sends end-of-stream signal when complete

### Client-Side (Frontend)

The debate page (`src/app/debate/page.tsx`) handles WebSocket audio chunks:

```typescript
// Listen for audio chunks
socket.on('aiSpeechAudioChunk', (chunk: Buffer) => {
  // Collect chunks
});

// Listen for end of stream
socket.on('aiSpeechAudioEnd', () => {
  // Combine chunks and play audio
});
```

## WebSocket Events

### Server → Client Events

1. **`aiSpeechAudioChunk`**: Sent for each audio chunk
   - Payload: `Buffer` containing audio data

2. **`aiSpeechAudioEnd`**: Sent when streaming is complete
   - No payload

3. **`aiSpeechAudio`**: Traditional event for HTTP audio (backward compatible)
   - Payload: Complete audio buffer

## Usage Example

### Enabling WebSocket Streaming

1. Set environment variable:
   ```bash
   export ELEVENLABS_WEBSOCKET_ENABLED=true
   ```

2. Start the server:
   ```bash
   npm run dev
   ```

3. The system will automatically use WebSocket streaming when available

### Monitoring

Watch the server logs for streaming status:
```
Generating TTS audio for Emily Carter...
TTS audio streamed to client for Emily Carter
```

If WebSocket fails:
```
WebSocket streaming failed, falling back to HTTP
TTS audio sent via HTTP for Emily Carter
```

## Performance Benefits

- **Lower latency**: Audio starts playing before generation is complete
- **Better user experience**: No waiting for entire audio file
- **Efficient resource usage**: Chunks are processed as they arrive
- **Graceful degradation**: Automatic fallback ensures reliability

## Troubleshooting

### WebSocket Not Connecting

1. Check if ELEVENLABS_WEBSOCKET_ENABLED is set to true
2. Verify ELEVENLABS_API_KEY is valid
3. Check network connectivity to wss://api.elevenlabs.io

### Audio Not Playing

1. Ensure client is handling both chunk and end events
2. Check browser console for errors
3. Verify audio format compatibility (MP3)

### Fallback to HTTP

The system automatically falls back to HTTP if:
- WebSocket connection fails
- Authentication errors occur
- Network issues prevent streaming

## Future Improvements

1. **Adaptive bitrate**: Adjust quality based on network conditions
2. **Partial playback**: Start playing before all chunks arrive
3. **WebSocket pooling**: Reuse connections for multiple speeches
4. **Compression**: Reduce bandwidth with audio compression