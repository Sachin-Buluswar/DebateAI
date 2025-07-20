# Troubleshooting

## Console Errors

### Error: Content Security Policy blocks the use of 'eval'

This error appears in development when Next.js dev tools or monitoring libraries (like Sentry) use eval. Fixed by custom CSP headers in `src/middleware.ts`:

1. The middleware sets appropriate CSP headers for development vs production
2. Development allows 'unsafe-eval' for dev tools
3. Production has stricter CSP without eval

If you still see this error:
- Ensure `src/middleware.ts` exists and is properly configured
- Restart the development server
- Clear browser cache

### Error: @import rules must be at the top of the stylesheet

CSS @import statements must come before any other CSS rules:

```css
/* Correct order */
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
@import '../styles/layout-system.css';

@tailwind base;
@tailwind components;
@tailwind utilities;
```

### Warning: Unsupported metadata viewport is configured in metadata export

In Next.js 14+, viewport configuration must be a separate export, not part of metadata:

```typescript
// ❌ Wrong - viewport in metadata
export const metadata: Metadata = {
  title: "App",
  viewport: "width=device-width, initial-scale=1",
};

// ✅ Correct - separate exports
export const metadata: Metadata = {
  title: "App",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};
```

### 404: /.well-known/appspecific/com.chrome.devtools.json

Chrome DevTools looks for this configuration file. Create it to avoid 404 errors:

```bash
mkdir -p public/.well-known/appspecific
echo '{"version": "1.0"}' > public/.well-known/appspecific/com.chrome.devtools.json
```

## Environment Issues

### Error: Cannot find module '@/lib/supabase/client'

```bash
npm install
npm run build
```

### Error: NEXT_PUBLIC_SUPABASE_URL is not defined

1. Check `.env.local` exists
2. Verify format:
```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```
3. Restart server:
```bash
kill -9 $(lsof -ti:3001)
npm run dev
```

## Build Errors

### Error: Type error in src/app/api/*/route.ts

```bash
npm run typecheck
# Fix errors shown
npm run lint -- --fix
```

### Error: Cannot resolve 'openai'

```bash
npm install openai@latest
```

## Database Errors

### Error: permission denied for table

1. Check RLS policies:
```sql
SELECT * FROM pg_policies WHERE tablename = 'your_table';
```

2. Enable RLS:
```sql
ALTER TABLE your_table ENABLE ROW LEVEL SECURITY;
```

3. Add policy:
```sql
CREATE POLICY "Users can view own data" ON your_table
FOR SELECT USING (auth.uid() = user_id);
```

### Error: relation does not exist

```bash
npx supabase db push
npx supabase db reset
```

## API Errors

### Error: 429 Too Many Requests

Rate limit hit. Add delay:
```typescript
await new Promise(resolve => setTimeout(resolve, 1000));
```

### Error: fetch failed

Check:
1. API endpoint URL correct
2. CORS headers set
3. Network connectivity

Fix CORS in `src/pages/api/socketio.ts`:
```typescript
cors: {
  origin: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001",
  methods: ["GET", "POST"]
}
```

## Socket.IO Errors

### Error: WebSocket connection failed

1. Check Socket.IO server running:
```bash
lsof -i :3001
```

2. Fix in `src/hooks/useRealtimeDebate.ts`:
```typescript
const socket = io(window.location.origin, {
  path: '/api/socketio',
  transports: ['websocket', 'polling']
});
```

### Error: JWT token invalid

Check token generation in `src/pages/api/socketio.ts`:
```typescript
const token = socket.handshake.auth.token;
const decoded = jwt.verify(token, process.env.JWT_SECRET);
```

## Audio Errors

### Error: MediaRecorder is not supported

Browser issue. Use Chrome or Edge.

### Error: No audio input detected

```javascript
navigator.mediaDevices.getUserMedia({ audio: true })
  .then(stream => console.log('Audio access granted'))
  .catch(err => console.error('Audio access denied', err));
```

## OpenAI Errors

### Error: 401 Unauthorized

Check API key in `.env.local`:
```
OPENAI_API_KEY=sk-...
```

### Error: Model not found

Use correct model name:
```typescript
model: "gpt-4o-mini"  // Not "gpt-4-mini"
```

## ElevenLabs Errors

### Error: Voice not found

Valid voice IDs:
```typescript
const VOICE_IDS = {
  sarah: "EXAVITQu4vr4xnSDxMaL",
  laura: "FGY2WhTYpPnrIDTdsKH5", 
  charlie: "IKne3meq5aSn9XLyUdCD",
  george: "JBFqnCBsd6RMkjVDRZzb",
  callum: "N2lVS1w4EtoT3dr4eOWO",
  charlotte: "XB0fDUnXU5powFXDhCwa",
  alice: "Xb7hH8MSUJpSbSDYk0k2",
  matilda: "XrExE9yKIg1WjnnlVkGX",
  will: "bIHbv24MWmeRgasZH58o",
  jessica: "cgSgspJ2msm6clMCkdW9"
};
```

## TypeScript Errors

### Error: Property does not exist on type

Add type definition:
```typescript
interface YourType {
  property: string;
}
```

### Error: Cannot find namespace

Add to `tsconfig.json`:
```json
{
  "compilerOptions": {
    "types": ["node", "@types/react"]
  }
}
```

## Production Issues

### Error: CORS blocked in production

Fix in `next.config.js`:
```javascript
async headers() {
  return [
    {
      source: "/api/:path*",
      headers: [
        { key: "Access-Control-Allow-Origin", value: process.env.NEXT_PUBLIC_APP_URL },
      ],
    },
  ];
}
```

### Error: Environment variables undefined

Ensure variables in Vercel/hosting platform:
- Go to Settings > Environment Variables
- Add all from `.env.local`
- Redeploy

## Debug Commands

```bash
# Check Node version
node --version  # Should be 18+

# Clear cache
rm -rf .next
rm -rf node_modules
npm install

# Check port usage
lsof -i :3001

# Database connection
npx supabase status

# Type checking
npx tsc --noEmit

# Find TypeScript errors
npm run typecheck

# Auto-fix linting
npm run lint -- --fix
```

## File Locations

- Logs: Check browser console and terminal
- Database logs: Supabase Dashboard > Logs
- API logs: `console.error` statements in route handlers
- Socket logs: `src/pages/api/socketio.ts`