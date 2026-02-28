import { NextRequest, NextResponse } from 'next/server';

// This endpoint helps initialize Socket.IO on Vercel
export async function GET(_request: NextRequest) {
  try {
    // Check if we're on Vercel
    const isVercel = process.env.VERCEL === '1';
    
    return NextResponse.json({
      status: 'ok',
      environment: {
        isVercel,
        nodeEnv: process.env.NODE_ENV,
        transport: isVercel ? 'polling-only' : 'websocket-polling',
        limitations: isVercel ? [
          'WebSocket connections not supported',
          'Using HTTP long-polling fallback',
          'Maximum connection duration: 30 seconds',
          'Slight increase in latency expected'
        ] : []
      },
      socketConfig: {
        path: '/api/socketio',
        transports: isVercel ? ['polling'] : ['polling', 'websocket'],
        upgrade: !isVercel,
      },
      timestamp: new Date().toISOString()
    });
  } catch (_error) {
    return NextResponse.json(
      { error: 'Failed to initialize socket configuration' },
      { status: 500 }
    );
  }
}

export async function POST(_request: NextRequest) {
  try {
    // Handle Socket.IO handshake if needed
    return NextResponse.json({ status: 'ok' });
  } catch (_error) {
    return NextResponse.json(
      { error: 'Socket handshake failed' },
      { status: 500 }
    );
  }
}