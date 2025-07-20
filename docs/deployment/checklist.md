# Deployment Checklist

## Critical Fixes (Must Complete)

### 1. Fix CORS Origin
File: `src/pages/api/socketio.ts:30`
```typescript
cors: {
  origin: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001",
  methods: ["GET", "POST"]
}
```

### 2. Add Viewport Meta Tag
File: `src/app/layout.tsx`
Add in `<head>`:
```html
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
```

### 3. Disable Debug Endpoint
File: `src/app/api/debug/route.ts`
```typescript
export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  // existing code
}
```

### 4. Sanitize File Paths
File: `src/backend/modules/speechFeedback/speechFeedbackService.ts`
```typescript
import path from 'path';
const sanitizedFileName = path.basename(fileName);
const audioPath = path.join(tmpDir, sanitizedFileName);
```

### 5. Fix Auth Error Messages
File: `src/app/auth/callback/route.ts`
Replace:
```typescript
return NextResponse.redirect(`${origin}/auth/error?message=${error.message}`);
```
With:
```typescript
return NextResponse.redirect(`${origin}/auth/error?code=auth_failed`);
```

## GitHub Secrets Configuration

Add to repository settings:
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
OPENAI_API_KEY
ELEVENLABS_API_KEY
OPENAI_VECTOR_STORE_ID
SENTRY_DSN
SENTRY_AUTH_TOKEN
```

## Pre-deployment Commands

```bash
# Install dependencies
npm ci

# Run all checks
npm run lint
npm run typecheck
npm run build

# Test critical features
npm run test:manual
```

## Environment Variables

Create `.env.production`:
```bash
NODE_ENV=production
NEXT_PUBLIC_APP_URL=https://your-domain.com
DATABASE_URL=postgresql://...
```

## Database Preparation

```bash
# Push schema to production
npx supabase db push --db-url $DATABASE_URL

# Verify RLS policies
npx supabase db test
```

## Docker Build

```bash
# Build production image
docker build -t debateai:latest .

# Test locally
docker run -p 3000:3000 --env-file .env.production debateai:latest

# Push to registry
docker tag debateai:latest your-registry/debateai:latest
docker push your-registry/debateai:latest
```

## Deployment Steps

### 1. GitHub Actions
```bash
# Trigger deployment
git tag -a v1.0.0 -m "Production release"
git push origin v1.0.0
```

### 2. Manual Deployment
```bash
# SSH to server
ssh user@production-server

# Pull latest image
docker pull your-registry/debateai:latest

# Stop current container
docker stop debateai

# Start new container
docker run -d \
  --name debateai \
  --restart always \
  -p 80:3000 \
  --env-file /path/to/.env.production \
  your-registry/debateai:latest
```

## Post-deployment Verification

```bash
# Check health endpoint
curl https://your-domain.com/api/health

# Check WebSocket
wscat -c wss://your-domain.com/api/socketio

# Check logs
docker logs debateai

# Monitor metrics
curl https://your-domain.com/api/metrics
```

## Rollback Procedure

```bash
# Stop failed deployment
docker stop debateai

# Start previous version
docker run -d \
  --name debateai \
  --restart always \
  -p 80:3000 \
  --env-file /path/to/.env.production \
  your-registry/debateai:previous-tag
```

## Required Files Check

Verify these files exist:
- `.env.production`
- `docker-compose.prod.yml`
- `.github/workflows/deploy.yml`
- `nginx.conf` (if using reverse proxy)
- `ssl/` directory with certificates

## DNS Configuration

Add records:
```
A     @          YOUR_SERVER_IP
A     www        YOUR_SERVER_IP
CNAME api        @
```

## SSL Setup

```bash
# Install certbot
sudo apt install certbot python3-certbot-nginx

# Get certificate
sudo certbot --nginx -d your-domain.com -d www.your-domain.com

# Auto-renewal
sudo certbot renew --dry-run
```

## Monitoring Setup

1. Add Sentry DSN to environment
2. Configure Grafana dashboard
3. Set up uptime monitoring
4. Configure alert webhooks

## Final Checks

- [ ] All critical fixes applied
- [ ] Environment variables set
- [ ] Database migrated
- [ ] SSL certificates active
- [ ] Health endpoint responding
- [ ] WebSocket connections working
- [ ] Monitoring active
- [ ] Backup configured