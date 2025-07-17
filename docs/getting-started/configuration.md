# Configuration Guide

This guide covers all configuration settings for DebateAI, including environment variables, API keys, and email setup.

## Environment Variables

### Required Variables

Create a `.env.local` file in the project root with the following variables:

```env
# Database & Authentication (Required)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# AI Services (Required)
OPENAI_API_KEY=your_openai_api_key
ELEVENLABS_API_KEY=your_elevenlabs_api_key

# Enhanced Features (Optional)
OPENAI_VECTOR_STORE_ID=your_vector_store_id
DEBUG_API_KEY=your_debug_key_for_development
```

### Getting Your API Keys

#### Supabase Configuration

1. **Project URL and Anon Key**:
   - Go to [Supabase Dashboard](https://app.supabase.com)
   - Select your project
   - Navigate to Settings → API
   - Copy the "Project URL" → `NEXT_PUBLIC_SUPABASE_URL`
   - Copy the "anon/public" key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

2. **Service Role Key**:
   - Same location (Settings → API)
   - Copy the "service_role" key → `SUPABASE_SERVICE_ROLE_KEY`
   - ⚠️ **Keep this secret!** Never expose in client-side code

#### OpenAI Configuration

1. Sign in to [OpenAI Platform](https://platform.openai.com)
2. Navigate to API keys section
3. Create a new API key
4. Copy the key → `OPENAI_API_KEY`
5. (Optional) For enhanced search:
   - Create a vector store in the Assistants section
   - Copy the store ID → `OPENAI_VECTOR_STORE_ID`

#### ElevenLabs Configuration

1. Sign in to [ElevenLabs](https://elevenlabs.io)
2. Go to Profile Settings
3. Copy your API key → `ELEVENLABS_API_KEY`
4. Note: Free tier includes 10,000 characters/month

### Optional Configuration

#### Debug API Key

For development debugging:
```env
DEBUG_API_KEY=your-secret-debug-key
```

This enables the `/api/debug` endpoint for troubleshooting.

## Email Template Configuration

DebateAI uses custom email templates for authentication. Follow these steps to set them up:

### Quick Setup (Recommended)

Run the interactive setup assistant:

```bash
npm run setup-emails
```

This will:
1. Guide you through each template
2. Copy templates to your clipboard
3. Show you where to paste them in Supabase

### Manual Email Setup

#### 1. Configure Email Templates

For each template type, copy and configure in Supabase Dashboard:

```bash
# Copy signup confirmation template
npm run copy-email confirm-signup
```

Then in Supabase:
1. Go to Authentication → Email Templates
2. Select "Confirm signup"
3. Enable "Custom email"
4. Paste the template
5. Save

Repeat for:
- `reset-password` - Password reset emails
- `magic-link` - Passwordless login emails
- `change-email` - Email address change confirmation

#### 2. Configure Email Settings

In Supabase Dashboard → Authentication → Email Settings:

- **Sender Email**: `noreply@yourdomain.com` (or your domain)
- **Sender Name**: "DebateAI"
- **Reply-To Email**: Your support email (optional)

#### 3. Custom SMTP (Optional but Recommended for Production)

For better email deliverability:

1. Go to Project Settings → Authentication → SMTP Settings
2. Enable "Custom SMTP"
3. Configure with your provider:

**SendGrid Example**:
```
Host: smtp.sendgrid.net
Port: 587
Username: apikey
Password: [Your SendGrid API Key]
```

**Other Providers**:
- Mailgun
- Amazon SES
- Postmark
- Any SMTP provider

### Email Template Features

Your configured emails will include:
- Minimalist design with sage green (#87A96B) branding
- Mobile-responsive layouts
- Clean typography with Inter font
- Sharp, modern design (no rounded corners)
- Consistent spacing and styling

## Authentication Configuration

### OAuth Providers (Optional)

To enable social login:

1. In Supabase Dashboard → Authentication → Providers
2. Enable desired providers:
   - Google
   - GitHub
   - Discord
   - Others as needed

3. Configure each provider with:
   - Client ID
   - Client Secret
   - Redirect URLs

### JWT Settings

Default JWT settings work for most cases, but you can customize:

1. Go to Authentication → JWT Settings
2. Configure:
   - **JWT Expiry**: Default 3600 (1 hour)
   - **JWT Secret**: Auto-generated (don't change)

## API Rate Limiting

The application includes built-in rate limiting. To customize:

1. Edit `src/lib/rateLimit.ts`
2. Adjust limits per endpoint:

```typescript
const limits = {
  '/api/debate': { requests: 30, window: '1m' },
  '/api/speech': { requests: 10, window: '1m' },
  '/api/search': { requests: 50, window: '1m' },
};
```

## Performance Configuration

### Database Connection Pooling

Supabase automatically handles connection pooling, but for high traffic:

1. Go to Settings → Database
2. Enable "Connection Pooling"
3. Choose "Transaction" mode for best performance

### Caching Configuration

The application uses various caching strategies:

- **API Responses**: 5-minute cache for search results
- **Static Assets**: Immutable cache headers
- **Database Queries**: Automatic Supabase caching

## Security Configuration

### Content Security Policy

Edit `next.config.js` to customize CSP headers:

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

### CORS Settings

For API access from other domains, configure in API routes:

```typescript
headers.set('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGINS || '*');
```

## Monitoring Configuration

### Error Tracking (Optional)

To enable Sentry error tracking:

```env
NEXT_PUBLIC_SENTRY_DSN=your_sentry_dsn
SENTRY_AUTH_TOKEN=your_sentry_auth_token
```

### Analytics (Optional)

For usage analytics:

```env
NEXT_PUBLIC_ANALYTICS_ID=your_analytics_id
```

## Verification

After configuration, verify everything is working:

```bash
# Check all environment variables
npm run check-env

# Test email sending
npm run test:email

# Verify API connections
npm run test:apis
```

## Troubleshooting Configuration

### Common Issues

1. **Invalid API Keys**:
   - Ensure no extra spaces in keys
   - Check key permissions/scopes
   - Verify billing is active

2. **Email Not Sending**:
   - Check spam folder
   - Verify SMTP settings
   - Ensure templates are saved

3. **Database Connection Failed**:
   - Verify Supabase URL is correct
   - Check service role key
   - Ensure RLS is properly configured

## Next Steps

Once configuration is complete:

1. Follow the [Quick Start Guide](./quick-start.md) to test your setup
2. Review [Security Best Practices](../ENVIRONMENT_SECRETS.md)
3. Set up [Monitoring](../MONITORING_GUIDE.md) for production