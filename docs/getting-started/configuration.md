# Configuration

## Environment Variables

### Create .env.local
```bash
cp .env.example .env.local
```

### Required Variables
```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
OPENAI_API_KEY=
ELEVENLABS_API_KEY=
```

### Optional Variables
```env
OPENAI_VECTOR_STORE_ID=
DEBUG_API_KEY=
```

## API Key Retrieval

### Supabase
1. https://app.supabase.com → Select project → Settings → API
2. Copy values:
   - Project URL → NEXT_PUBLIC_SUPABASE_URL
   - anon/public key → NEXT_PUBLIC_SUPABASE_ANON_KEY
   - service_role key → SUPABASE_SERVICE_ROLE_KEY

### OpenAI
1. https://platform.openai.com → API keys
2. Create new key → OPENAI_API_KEY
3. Optional: Assistants → Create vector store → Copy ID → OPENAI_VECTOR_STORE_ID

### ElevenLabs
1. https://elevenlabs.io → Profile Settings
2. Copy API key → ELEVENLABS_API_KEY

## Email Templates

### Automated Setup
```bash
npm run setup-emails
```

### Manual Setup
```bash
# Copy each template
npm run copy-email confirm-signup
npm run copy-email reset-password
npm run copy-email magic-link
npm run copy-email change-email
```

Apply in Supabase:
1. Authentication → Email Templates
2. Select template type
3. Enable "Custom email"
4. Paste template
5. Save

### Email Settings
Authentication → Email Settings:
- Sender Email: noreply@yourdomain.com
- Sender Name: DebateAI

### SMTP Configuration
Project Settings → Authentication → SMTP Settings:
1. Enable "Custom SMTP"
2. Configure:
```
Host: smtp.sendgrid.net
Port: 587
Username: apikey
Password: [SendGrid API Key]
```

## Rate Limiting

Edit /Users/sachinbuluswar/Documents/debatetest2/src/lib/rateLimit.ts:
```typescript
const limits = {
  '/api/debate': { requests: 30, window: '1m' },
  '/api/speech': { requests: 10, window: '1m' },
  '/api/search': { requests: 50, window: '1m' },
};
```

## Security

### CSP Headers
Edit /Users/sachinbuluswar/Documents/debatetest2/next.config.js:
```javascript
const cspHeader = `
  default-src 'self';
  script-src 'self' 'unsafe-eval' 'unsafe-inline';
  style-src 'self' 'unsafe-inline';
  img-src 'self' blob: data:;
  font-src 'self';
  connect-src 'self' *.supabase.co wss://*.supabase.co api.openai.com api.elevenlabs.io;
`;
```

### CORS
In API routes:
```typescript
headers.set('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGINS || '*');
```

## Verification
```bash
# Check environment
npm run check-env

# Test email
npm run test:email

# Test APIs
npm run test:apis
```

## Common Errors

### Invalid API Keys
- Remove spaces from keys
- Verify key permissions
- Check billing active

### Email Not Sending
- Check spam folder
- Verify SMTP settings
- Confirm templates saved

### Database Connection Failed
- Verify Supabase URL correct
- Check service role key
- Ensure RLS configured

## File Locations
Environment: /Users/sachinbuluswar/Documents/debatetest2/.env.local
Rate limiting: /Users/sachinbuluswar/Documents/debatetest2/src/lib/rateLimit.ts
Security config: /Users/sachinbuluswar/Documents/debatetest2/next.config.js