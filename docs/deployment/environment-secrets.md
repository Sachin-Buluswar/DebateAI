# Environment Variables and Secrets Configuration

This document details all environment variables and secrets required for the DebateAI application and CI/CD pipeline.

## Application Environment Variables

### Core Supabase Configuration
```env
# Required for all environments
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### AI Service Keys
```env
# OpenAI Configuration
OPENAI_API_KEY=sk-...
OPENAI_VECTOR_STORE_ID=vs_...

# ElevenLabs Configuration
ELEVENLABS_API_KEY=your-elevenlabs-key
```

### Optional Development Variables
```env
# Debug and Development
DEBUG_API_KEY=your-debug-key
NODE_ENV=development|production
```

## GitHub Actions Secrets

### Required Secrets for CI/CD

#### 1. Application Secrets
These are the same as your application environment variables:

| Secret Name | Description | Required |
|------------|-------------|----------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | ✅ |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous key | ✅ |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key | ✅ |
| `OPENAI_API_KEY` | OpenAI API key | ✅ |
| `OPENAI_VECTOR_STORE_ID` | OpenAI vector store ID | ✅ |
| `ELEVENLABS_API_KEY` | ElevenLabs API key | ✅ |

#### 2. Test Environment Secrets
For running tests in CI:

| Secret Name | Description | Required |
|------------|-------------|----------|
| `TEST_SUPABASE_URL` | Test Supabase project URL | ✅ |
| `TEST_SUPABASE_ANON_KEY` | Test Supabase anonymous key | ✅ |
| `TEST_SUPABASE_SERVICE_ROLE_KEY` | Test service role key | ✅ |

#### 3. Deployment Secrets

##### Staging Deployment
| Secret Name | Description | Example |
|------------|-------------|---------|
| `STAGING_HOST` | Staging server hostname | `staging.debateai.com` |
| `STAGING_USER` | SSH username for staging | `deploy` |
| `STAGING_SSH_KEY` | Private SSH key for staging | See SSH key setup below |
| `STAGING_DATABASE_URL` | Staging database connection | `postgresql://...` |

##### Production Deployment
| Secret Name | Description | Example |
|------------|-------------|---------|
| `PRODUCTION_HOST` | Production server hostname | `debateai.com` |
| `PRODUCTION_USER` | SSH username for production | `deploy` |
| `PRODUCTION_SSH_KEY` | Private SSH key for production | See SSH key setup below |
| `PRODUCTION_DATABASE_URL` | Production database connection | `postgresql://...` |

#### 4. Optional Integration Secrets

| Secret Name | Description | Used For |
|------------|-------------|----------|
| `CODECOV_TOKEN` | Codecov integration token | Test coverage reporting |
| `SNYK_TOKEN` | Snyk security scanning token | Dependency vulnerability scanning |
| `SENTRY_DSN` | Sentry error tracking DSN | Error monitoring |
| `SLACK_WEBHOOK_URL` | Slack webhook for notifications | Deployment notifications |
| `DISCORD_WEBHOOK_URL` | Discord webhook for notifications | Alternative notifications |

## Setting Up Secrets in GitHub

### 1. Navigate to Repository Settings
```
Your Repository → Settings → Secrets and variables → Actions
```

### 2. Add Repository Secrets
Click "New repository secret" and add each secret.

### 3. SSH Key Setup

Generate SSH keys for deployment:

```bash
# Generate SSH key pair for staging
ssh-keygen -t ed25519 -f staging_deploy_key -C "github-actions-staging" -N ""

# Generate SSH key pair for production
ssh-keygen -t ed25519 -f production_deploy_key -C "github-actions-production" -N ""
```

Add the public keys to your servers:
```bash
# On staging server
cat staging_deploy_key.pub >> ~/.ssh/authorized_keys

# On production server
cat production_deploy_key.pub >> ~/.ssh/authorized_keys
```

Add the private keys as GitHub secrets:
- Copy contents of `staging_deploy_key` to `STAGING_SSH_KEY`
- Copy contents of `production_deploy_key` to `PRODUCTION_SSH_KEY`

## Environment-Specific Configuration

### Development (.env.local)
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-dev-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-dev-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-dev-service-key
OPENAI_API_KEY=sk-dev-...
OPENAI_VECTOR_STORE_ID=vs_dev_...
ELEVENLABS_API_KEY=your-dev-elevenlabs-key
DEBUG_API_KEY=dev-debug-key
```

### Staging (.env.staging)
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-staging-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-staging-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-staging-service-key
OPENAI_API_KEY=sk-staging-...
OPENAI_VECTOR_STORE_ID=vs_staging_...
ELEVENLABS_API_KEY=your-staging-elevenlabs-key
```

### Production (.env.production)
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-prod-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-prod-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-prod-service-key
OPENAI_API_KEY=sk-prod-...
OPENAI_VECTOR_STORE_ID=vs_prod_...
ELEVENLABS_API_KEY=your-prod-elevenlabs-key
```

## Security Best Practices

### 1. Secret Rotation Schedule
- **API Keys**: Rotate every 90 days
- **SSH Keys**: Rotate every 180 days
- **Database URLs**: Update when credentials change

### 2. Access Control
- Limit repository access to necessary team members
- Use GitHub environments for production secrets
- Require approval for production deployments

### 3. Secret Management
- Never commit secrets to the repository
- Use `.gitignore` to exclude `.env*` files
- Regularly audit secret usage
- Remove unused secrets

### 4. Monitoring
- Set up alerts for failed authentication
- Monitor API key usage and limits
- Track deployment access logs

## Validation Script

Create a script to validate environment variables:

```bash
#!/bin/bash
# scripts/validate-env.sh

required_vars=(
  "NEXT_PUBLIC_SUPABASE_URL"
  "NEXT_PUBLIC_SUPABASE_ANON_KEY"
  "SUPABASE_SERVICE_ROLE_KEY"
  "OPENAI_API_KEY"
  "OPENAI_VECTOR_STORE_ID"
  "ELEVENLABS_API_KEY"
)

missing_vars=()

for var in "${required_vars[@]}"; do
  if [ -z "${!var}" ]; then
    missing_vars+=("$var")
  fi
done

if [ ${#missing_vars[@]} -eq 0 ]; then
  echo "✅ All required environment variables are set"
else
  echo "❌ Missing required environment variables:"
  printf '%s\n' "${missing_vars[@]}"
  exit 1
fi
```

## Troubleshooting

### Common Issues

1. **Build fails with "Missing environment variable"**
   - Ensure all required secrets are set in GitHub
   - Check secret names match exactly (case-sensitive)

2. **Deployment fails with "Permission denied"**
   - Verify SSH key is correctly added to server
   - Check SSH key format (no extra newlines)
   - Ensure deploy user has necessary permissions

3. **API calls fail in production**
   - Verify API keys are for production environment
   - Check API rate limits and quotas
   - Ensure keys have necessary permissions

### Debug Commands

```bash
# Check which secrets are available in workflow
- name: Debug secrets
  run: |
    echo "Checking secret availability..."
    if [ -n "${{ secrets.OPENAI_API_KEY }}" ]; then
      echo "✓ OPENAI_API_KEY is set"
    else
      echo "✗ OPENAI_API_KEY is missing"
    fi

# Test database connection
- name: Test database
  run: |
    psql "${{ secrets.DATABASE_URL }}" -c "SELECT 1"
```

## Support

For issues with secrets or environment configuration:
1. Check this documentation first
2. Review GitHub Actions logs
3. Contact the DevOps team
4. Submit an issue with sanitized error messages