import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * Utility endpoint to execute SQL for admin operations
 * This is used by storage policy scripts and migrations
 * SECURITY: Only accessible with service role
 */
export async function POST(req: NextRequest) {
  // SECURITY HARDENING ------------------------------------------------------
  // 1. Require an admin secret sent via header `x-admin-key`.
  // 2. Allow execution ONLY if an environment flag `ENABLE_SQL_ENDPOINT` is
  //    truthy. This prevents accidental exposure in production builds where the
  //    flag is not set.

  if (!process.env.ENABLE_SQL_ENDPOINT) {
    return NextResponse.json({ error: 'Endpoint disabled' }, { status: 404 });
  }

  const adminKeyHeader = req.headers.get('x-admin-key');
  const expectedAdminKey = process.env.ADMIN_SQL_KEY;

  if (!expectedAdminKey || adminKeyHeader !== expectedAdminKey) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { query } = await req.json();

    if (!query || typeof query !== 'string') {
      return NextResponse.json({ error: 'SQL query is required' }, { status: 400 });
    }

    // Use service role key only on the server; never expose to client
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: { persistSession: false },
      }
    );

    const { data, error } = await supabaseAdmin.rpc('execute_sql', { query });

    if (error) {
      console.error('Error executing SQL:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (err) {
    const error = err as Error;
    console.error('API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
} 