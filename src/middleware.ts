import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { corsMiddleware } from './middleware/cors';

export function middleware(request: NextRequest) {
  // Handle CORS first
  const corsResponse = corsMiddleware(request);
  if (request.method === 'OPTIONS') {
    return corsResponse;
  }
  
  const response = corsResponse || NextResponse.next();
  
  // In development, allow 'unsafe-eval' for Next.js dev tools and Sentry
  if (process.env.NODE_ENV === 'development') {
    response.headers.set(
      'Content-Security-Policy',
      "default-src 'self'; " +
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.sentry.io https://*.sentry-cdn.com; " +
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
      "font-src 'self' https://fonts.gstatic.com data:; " +
      "img-src 'self' data: https: blob:; " +
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.sentry.io https://api.openai.com https://api.elevenlabs.io ws://localhost:* wss://localhost:*; " +
      "media-src 'self' blob: data:; " +
      "worker-src 'self' blob:; " +
      "child-src 'self' blob:; " +
      "frame-src 'self' https://docs.google.com;"
    );
  } else {
    // Production CSP - more restrictive, no eval
    response.headers.set(
      'Content-Security-Policy',
      "default-src 'self'; " +
      "script-src 'self' 'unsafe-inline' https://*.sentry.io https://*.sentry-cdn.com; " +
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
      "font-src 'self' https://fonts.gstatic.com data:; " +
      "img-src 'self' data: https: blob:; " +
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.sentry.io https://api.openai.com https://api.elevenlabs.io; " +
      "media-src 'self' blob: data:; " +
      "worker-src 'self' blob:; " +
      "child-src 'self' blob:; " +
      "frame-src 'self' https://docs.google.com;"
    );
  }
  
  return response;
}

// Configure which routes the middleware should run on
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * Include API routes for CORS handling
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};