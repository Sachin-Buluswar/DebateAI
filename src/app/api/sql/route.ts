import { NextRequest, NextResponse } from 'next/server';

/**
 * SQL endpoint has been permanently disabled for security
 * This endpoint should not exist in production
 */
export async function POST(req: NextRequest) {
  return NextResponse.json(
    { error: 'Endpoint permanently disabled for security' },
    { status: 403 }
  );
}

export async function GET(req: NextRequest) {
  return NextResponse.json(
    { error: 'Endpoint permanently disabled for security' },
    { status: 403 }
  );
}