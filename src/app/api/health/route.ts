import { NextResponse } from 'next/server';
import { env } from '@/shared/env';

export async function GET() {
  const healthCheck = {
    uptime: process.uptime(),
    message: 'OK',
    timestamp: Date.now(),
    checks: {
      env: 'OK',
    },
  };

  try {
    // A simple check to see if env variables are loaded.
    if (
      !env.OPENAI_API_KEY ||
      !env.SUPABASE_SERVICE_ROLE_KEY ||
      !env.NEXT_PUBLIC_SUPABASE_URL
    ) {
      healthCheck.checks.env = 'ERROR: Missing required environment variables.';
      return NextResponse.json(healthCheck, { status: 500 });
    }

    return NextResponse.json(healthCheck);
  } catch (error) {
    healthCheck.message = 'ERROR';
    return NextResponse.json(
      { ...healthCheck, error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
} 