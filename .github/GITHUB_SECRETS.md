# GitHub Actions Secrets Configuration

This document lists all the secrets that need to be configured in your GitHub repository for the CI/CD pipeline to work correctly.

## Required Secrets

Navigate to your GitHub repository → Settings → Secrets and variables → Actions, then add the following secrets:

### Core Application Secrets

1. **NEXT_PUBLIC_SUPABASE_URL**
   - Your Supabase project URL
   - Example: `https://xxxxxxxxxxxxxxxxxxxxx.supabase.co`

2. **NEXT_PUBLIC_SUPABASE_ANON_KEY**
   - Your Supabase anonymous/public key
   - Found in Supabase Dashboard → Settings → API

3. **SUPABASE_SERVICE_ROLE_KEY**
   - Your Supabase service role key (keep this secret!)
   - Found in Supabase Dashboard → Settings → API

4. **OPENAI_API_KEY**
   - Your OpenAI API key
   - Get from: https://platform.openai.com/api-keys

5. **OPENAI_VECTOR_STORE_ID**
   - Your OpenAI Vector Store ID for wiki search
   - Created via OpenAI API or Dashboard

6. **ELEVENLABS_API_KEY**
   - Your ElevenLabs API key for TTS/STT
   - Get from: https://elevenlabs.io/api

### Optional Secrets

7. **DEBUG_API_KEY** (optional)
   - Custom API key for debug endpoints
   - Generate a secure random string

8. **CODECOV_TOKEN** (optional)
   - For code coverage reporting
   - Get from: https://codecov.io/

9. **SNYK_TOKEN** (optional)
   - For security vulnerability scanning
   - Get from: https://snyk.io/

## Setting Secrets via GitHub CLI

If you have the GitHub CLI installed, you can set secrets using:

```bash
# Set a secret
gh secret set NEXT_PUBLIC_SUPABASE_URL --body "your-supabase-url"

# Set a secret from a file
gh secret set OPENAI_API_KEY < api-key.txt

# List all secrets
gh secret list
```

## Environment-Specific Secrets

For deployment environments, you may also need:

### Staging Environment
- Set these in: Settings → Environments → staging → Environment secrets
- Can override the repository secrets for staging-specific values

### Production Environment
- Set these in: Settings → Environments → production → Environment secrets
- Should use production API keys and endpoints

## Security Best Practices

1. **Never commit secrets** to your repository
2. **Rotate secrets regularly** (every 90 days recommended)
3. **Use least privilege** - only grant necessary permissions
4. **Monitor secret usage** in GitHub's security tab
5. **Enable secret scanning** in repository settings

## Verifying Secrets

After setting up secrets, you can verify they're working by:

1. Running the CI/CD workflow manually:
   - Go to Actions → CI/CD Pipeline → Run workflow

2. Checking the workflow logs for any authentication errors

3. Ensuring all workflow steps pass successfully

## Troubleshooting

If workflows fail due to missing secrets:

1. Check the exact secret name matches (case-sensitive)
2. Ensure no extra spaces in secret values
3. Verify the secret is available to the workflow context
4. Check if using environment-specific secrets correctly

For more help, see: https://docs.github.com/en/actions/security-guides/encrypted-secrets