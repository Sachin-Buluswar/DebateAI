import { NextRequest, NextResponse } from 'next/server';
import { blockEndpoint } from '@/lib/auth-middleware';

/**
 * MIGRATIONS ENDPOINT - PERMANENTLY DISABLED
 * 
 * This endpoint was a critical security vulnerability that could execute
 * arbitrary SQL commands. It has been permanently disabled.
 * 
 * Migrations should ONLY be run through:
 * 1. Supabase Dashboard SQL Editor
 * 2. Supabase CLI (supabase db push)
 * 3. Version-controlled migration files
 * 
 * NEVER through an API endpoint.
 */

export async function POST(_request: NextRequest): Promise<NextResponse> {
  // This endpoint is permanently disabled for security
  return blockEndpoint(
    'Database migrations cannot be run through API endpoints. ' +
    'Please use the Supabase Dashboard or CLI to run migrations safely.'
  );
}

export async function GET(_request: NextRequest): Promise<NextResponse> {
  // Also block GET requests
  return blockEndpoint(
    'Database migrations cannot be accessed through API endpoints. ' +
    'Please use the Supabase Dashboard or CLI to manage migrations.'
  );
}