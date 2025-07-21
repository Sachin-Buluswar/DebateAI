# Socket.IO on Vercel - Configuration and Limitations

## Overview

Vercel's serverless architecture doesn't support persistent WebSocket connections, which affects real-time features in Eris Debate. This document explains the limitations and our solutions.

## The Problem

1. **No WebSocket Support**: Vercel's serverless functions terminate after max 30 seconds
2. **Stateless Architecture**: Each request creates a new function instance
3. **Connection Errors**: Clients attempting WebSocket connections will fail

## Our Solution

### 1. Force HTTP Long-Polling

We've configured Socket.IO to use HTTP long-polling exclusively on Vercel:

```typescript
// Client-side configuration (src/lib/socket/socketConfig.ts)
if (isVercel()) {
  return {
    transports: ['polling'], // Only use polling
    upgrade: false,         // Never upgrade to WebSocket
  };
}
```

### 2. Server Configuration

The Socket.IO server also detects Vercel and adjusts:

```typescript
// Server-side (src/pages/api/socketio.ts)
transports: process.env.VERCEL ? ['polling'] : ['polling', 'websocket']
```

### 3. Environment Variables

Add these to your Vercel project settings:

```env
NEXT_PUBLIC_VERCEL=1
NEXT_PUBLIC_SITE_URL=https://atlasdebate.com
ALLOWED_ORIGINS=https://atlasdebate.com,https://www.atlasdebate.com
```

### 4. User Experience

- Users see a warning about limited real-time features
- The app continues to function with slightly higher latency
- All debate features remain available

## Deployment Steps

1. **Push Code**: The updated code with polling configuration
2. **Set Environment Variables**: In Vercel dashboard → Settings → Environment Variables
3. **Deploy**: Vercel will automatically use the new configuration

## Testing

To verify Socket.IO is using polling:

1. Open browser console on your deployed site
2. Look for: "Socket connected successfully via: polling"
3. Check `/api/socket-init` endpoint for configuration details

## Limitations

### What Works
- ✅ All debate functionality
- ✅ Real-time updates (with slight delay)
- ✅ Audio streaming
- ✅ Turn management

### What's Different
- ⚠️ ~100-500ms additional latency
- ⚠️ More HTTP requests (polling)
- ⚠️ 30-second maximum connection time per request

## Alternative Solutions

For production deployments requiring true real-time features:

1. **Use a Different Host**: Deploy on services supporting WebSockets (Railway, Render, AWS)
2. **Separate Services**: Keep Next.js on Vercel, run Socket.IO elsewhere
3. **Managed WebSocket Services**: Use Pusher, Ably, or similar

## Troubleshooting

### Still Getting WebSocket Errors?

1. Clear browser cache
2. Check `NEXT_PUBLIC_VERCEL=1` is set in Vercel
3. Verify the domain in error matches your allowed origins

### Connection Timeouts?

- Normal on Vercel - Socket.IO will reconnect automatically
- Polling connections reconnect every 20-25 seconds

### Debug Endpoints

- `/api/socket-init` - Check Socket.IO configuration
- `/api/debug?key=YOUR_KEY` - Full system diagnostics
- `/api/health` - Basic health check

## Code References

- Client config: `src/lib/socket/socketConfig.ts`
- Server handler: `src/pages/api/socketio.ts`
- Fallback logic: `src/lib/socket/socketFallback.ts`
- Debate page: `src/app/debate/page.tsx:240-300`

---

For more help, check the main [deployment guide](./deployment-process.md) or contact support.