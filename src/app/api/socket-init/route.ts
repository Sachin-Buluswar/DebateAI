import { NextRequest, NextResponse } from 'next/server';

// This endpoint helps initialize Socket.IO on Vercel
export async function GET(request: NextRequest) {
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
}

export async function POST(request: NextRequest) {
  // Handle Socket.IO handshake if needed
  return NextResponse.json({ status: 'ok' });
}