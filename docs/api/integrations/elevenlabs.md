# ElevenLabs API Reference

> **Status:** ✅ Updated with latest API information

## Overview

DebateAI uses ElevenLabs for all real-time voice capabilities:

1. **Text-to-Speech (TTS)** – Generate natural AI debate speeches with distinct voices
2. **Speech-to-Text (STT)** – Transcribe user speech in real-time during debates
3. **Conversational Voice API** – Enable low-latency crossfire sessions (<200ms)

## Quick Links

- [Official API Docs](https://docs.elevenlabs.io/)
- [TTS API Reference](https://docs.elevenlabs.io/api-reference/text-to-speech)
- [STT API Reference](https://docs.elevenlabs.io/api-reference/speech-to-text)
- [Streaming Guide](https://docs.elevenlabs.io/api-reference/streaming)

---

## Authentication

All requests require the `xi-api-key` header:

```http
xi-api-key: $ELEVENLABS_API_KEY
```

Store in `.env.local`:
```env
ELEVENLABS_API_KEY=your_api_key_here
```

**Security**: Never expose the API key to the client. All ElevenLabs calls should go through your backend.

---

## Text-to-Speech (TTS)

Used in: `src/backend/services/ttsService.ts`, debate speech generation

### Basic TTS Request

```ts
const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
  method: 'POST',
  headers: {
    'xi-api-key': process.env.ELEVENLABS_API_KEY,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    text: "Good afternoon, judges.",
    model_id: "eleven_turbo_v2_5",  // Low latency model
    voice_settings: {
      stability: 0.5,
      similarity_boost: 0.75,
      style: 0.0,
      use_speaker_boost: true
    }
  })
})
```

### Streaming TTS (Recommended)

For immediate playback and better UX:

```ts
const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`, {
  method: 'POST',
  headers: {
    'xi-api-key': process.env.ELEVENLABS_API_KEY,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    text: speechText,
    model_id: "eleven_turbo_v2_5",
    stream: true,
    optimize_streaming_latency: 3  // Balance between latency and quality
  })
})

// Stream to client
const reader = response.body.getReader()
while (true) {
  const { done, value } = await reader.read()
  if (done) break
  // Send chunk to client via WebSocket or Server-Sent Events
}
```

### Voice Models

| Model | Latency | Quality | Use Case |
|-------|---------|---------|----------|
| eleven_turbo_v2_5 | ~400ms | Good | Real-time debates |
| eleven_multilingual_v2 | ~1s | Excellent | Pre-generated content |
| eleven_flash_v2_5 | ~200ms | Fair | Ultra-low latency needs |

### Voice Settings Guide

- **stability** (0.0-1.0): Lower = more expressive, Higher = more consistent
- **similarity_boost** (0.0-1.0): Higher = closer to original voice
- **style** (0.0-1.0): Higher = more exaggerated delivery
- **use_speaker_boost**: Enhances voice clarity

---

## Speech-to-Text (STT)

Used in: `src/pages/api/stt.ts`, user speech transcription

### WebSocket Streaming STT

Real-time transcription for debate interactions:

```ts
const socket = new WebSocket('wss://api.elevenlabs.io/v1/speech-to-text/stream', [
  `api_key=${process.env.ELEVENLABS_API_KEY}`
])

socket.onopen = () => {
  // Send audio configuration
  socket.send(JSON.stringify({
    audio: {
      encoding: 'pcm_16000',  // 16kHz PCM
      sample_rate: 16000
    }
  }))
}

// Send audio chunks
socket.send(audioChunk)  // Raw PCM audio data

// Receive transcriptions
socket.onmessage = (event) => {
  const data = JSON.parse(event.data)
  if (data.text) {
    console.log('Transcript:', data.text)
    console.log('Is final:', data.isFinal)
  }
}
```

### Audio Format Requirements

- **Format**: PCM (raw audio)
- **Sample Rate**: 16kHz mono
- **Bit Depth**: 16-bit
- **Chunk Size**: Send every 100-250ms for best results

---

## Conversational Voice API

Used in: `src/backend/modules/realtimeDebate/`, crossfire sessions

### Multi-Context WebSocket

For managing multiple AI voices in crossfire:

```ts
const wsUrl = `wss://api.elevenlabs.io/v1/text-to-speech/${voiceId}/multi-stream-input`
  + `?model_id=eleven_turbo_v2_5`
  + `&inactivity_timeout=20`

const socket = new WebSocket(wsUrl, {
  headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY }
})

// Send text for specific context (AI participant)
socket.send(JSON.stringify({
  text: "That's an interesting point, but consider...",
  context_id: "ai_participant_1",
  voice_settings: { stability: 0.5, similarity_boost: 0.8 }
}))

// Handle interruptions
socket.send(JSON.stringify({
  context_id: "ai_participant_1",
  close_context: true  // Stop current speech
}))
```

### Best Practices for Real-Time

1. **Use Contexts**: One per AI participant for clean management
2. **Handle Interruptions**: Close context immediately when user speaks
3. **Chunk Text**: Send sentences as they're generated
4. **Monitor Latency**: Track round-trip time for quality assurance

---

## Rate Limits & Quotas

| Plan | TTS | STT | Concurrent |
|------|-----|-----|------------|
| Starter | 10K chars/mo | 30 min/mo | 2 requests |
| Creator | 100K chars/mo | 500 min/mo | 5 requests |
| Pro | 500K chars/mo | 1000 min/mo | 10 requests |

Monitor headers:
- `X-RateLimit-Remaining`
- `X-RateLimit-Reset`

---

## Error Handling

### Common Errors

```ts
try {
  const response = await fetch(...)
  
  if (!response.ok) {
    switch (response.status) {
      case 401:
        throw new Error('Invalid API key')
      case 429:
        // Rate limited - check headers
        const retryAfter = response.headers.get('Retry-After')
        throw new Error(`Rate limited. Retry after ${retryAfter}s`)
      case 422:
        throw new Error('Invalid voice ID or parameters')
      default:
        throw new Error(`ElevenLabs error: ${response.statusText}`)
    }
  }
} catch (error) {
  // Implement exponential backoff for retries
}
```

### Retry Strategy

```ts
async function elevenLabsRequest(fn, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn()
    } catch (error) {
      if (error.status === 429 && i < maxRetries - 1) {
        const delay = Math.pow(2, i) * 1000
        await new Promise(r => setTimeout(r, delay))
        continue
      }
      throw error
    }
  }
}
```

---

## Optimization Tips

### 1. Voice Caching

```ts
// Cache voice list at startup
let voiceCache = null

async function getVoices() {
  if (!voiceCache) {
    const response = await fetch('https://api.elevenlabs.io/v1/voices', {
      headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY }
    })
    voiceCache = await response.json()
  }
  return voiceCache
}
```

### 2. Chunk Size Optimization

- **TTS**: Keep under 2,500 chars per request
- **Streaming**: Send complete sentences with `flush: true`
- **STT**: 100-250ms audio chunks for best accuracy

### 3. Latency Reduction

- Use `eleven_turbo_v2_5` for real-time needs
- Enable `optimize_streaming_latency`
- Prefetch first audio chunk before full generation
- Use WebSocket connections for persistent sessions

---

## Project-Specific Patterns

### Debate Speech Generation

```ts
// Pattern for AI debate speeches
async function generateDebateSpeech(text: string, participant: string) {
  const voiceId = PARTICIPANT_VOICES[participant]
  
  return await streamTTS({
    text,
    voiceId,
    model: 'eleven_turbo_v2_5',
    voiceSettings: {
      stability: 0.4,  // More expressive for debates
      similarity_boost: 0.8,
      style: 0.3,  // Some style variation
      use_speaker_boost: true
    }
  })
}
```

### Crossfire Management

```ts
// Pattern for multi-participant crossfire
class CrossfireManager {
  async handleParticipantSpeech(participantId: string, text: string) {
    // Close other contexts
    this.closeOtherContexts(participantId)
    
    // Start new speech
    await this.socket.send(JSON.stringify({
      text,
      context_id: participantId,
      flush: true
    }))
  }
}
``` 