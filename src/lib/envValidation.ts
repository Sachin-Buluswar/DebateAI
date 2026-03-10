// Environment validation utility
export interface EnvValidationResult {
  isValid: boolean;
  missing: string[];
  warnings: string[];
}

export function validateEnvironment(): EnvValidationResult {
  const requiredVars = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  ];

  const serverOnlyVars = [
    'SUPABASE_SERVICE_ROLE_KEY',
    'OPENAI_API_KEY',
    'ELEVENLABS_API_KEY',
    'OPENAI_VECTOR_STORE_ID',
  ];

  const missing: string[] = [];
  const warnings: string[] = [];

  // Check required client-side variables
  requiredVars.forEach(varName => {
    if (!process.env[varName]) {
      missing.push(varName);
    }
  });

  // Check if we're in a server context
  if (typeof window === 'undefined') {
    serverOnlyVars.forEach(varName => {
      if (!process.env[varName]) {
        missing.push(varName);
      }
    });
  }

  // Add warnings for common issues
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && !process.env.NEXT_PUBLIC_SUPABASE_URL.includes('supabase.co')) {
    warnings.push('NEXT_PUBLIC_SUPABASE_URL does not appear to be a valid Supabase URL');
  }

  // Check for Vercel-specific variables
  if (process.env.VERCEL) {
    if (!process.env.NEXT_PUBLIC_SITE_URL) {
      warnings.push('NEXT_PUBLIC_SITE_URL is not set - this may cause CORS issues on Vercel');
    }
  }

  return {
    isValid: missing.length === 0,
    missing,
    warnings,
  };
}

