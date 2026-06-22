import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-middleware';

/**
 * Debug endpoint - ADMIN ONLY
 *
 * Security measures:
 * 1. Completely disabled in production unless explicitly enabled
 * 2. Requires admin authentication
 * 3. No service role key usage
 * 4. No data modification capabilities
 */
export async function GET(request: NextRequest) {
  // SECURITY: Disable completely in production unless explicitly enabled
  if (process.env.NODE_ENV === 'production') {
    if (process.env.ENABLE_DEBUG_ENDPOINT !== 'true') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
  }

  return requireAdmin(request, async (req) => {
    const requiredVars = [
      'NEXT_PUBLIC_SUPABASE_URL',
      'NEXT_PUBLIC_SUPABASE_ANON_KEY',
      'SUPABASE_SERVICE_ROLE_KEY',
      'OPENAI_API_KEY',
      'ELEVENLABS_API_KEY',
      'OPENAI_VECTOR_STORE_ID',
    ] as const;

    const missing = requiredVars.filter((v) => !process.env[v]);

    const diagnostics = {
      timestamp: new Date().toISOString(),
      deployment: {
        environment: process.env.NODE_ENV || 'unknown',
        vercel: {
          isVercel: process.env.VERCEL === '1',
          region: process.env.VERCEL_REGION,
          url: process.env.VERCEL_URL,
        },
        host: request.headers.get('host') || undefined,
        protocol: request.headers.get('x-forwarded-proto') || 'http',
      },
      envValidation: {
        isValid: missing.length === 0,
        missing,
        variables: {
          NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
          NEXT_PUBLIC_SUPABASE_ANON_KEY: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
          OPENAI_API_KEY: !!process.env.OPENAI_API_KEY,
          ELEVENLABS_API_KEY: !!process.env.ELEVENLABS_API_KEY,
          OPENAI_VECTOR_STORE_ID: !!process.env.OPENAI_VECTOR_STORE_ID,
          NEXT_PUBLIC_SITE_URL: !!process.env.NEXT_PUBLIC_SITE_URL,
          ALLOWED_ORIGINS: !!process.env.ALLOWED_ORIGINS,
        },
      },
      adminUser: req.user.email,
      requestIP:
        request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
    };

    return NextResponse.json(diagnostics);
  });
}
