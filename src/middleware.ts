import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { corsMiddleware } from './middleware/cors';
import { authMiddleware } from './middleware/auth';

export async function middleware(request: NextRequest) {
  // Handle CORS first
  const corsResponse = corsMiddleware(request);
  if (request.method === 'OPTIONS') {
    return corsResponse;
  }
  
  // Check authentication for protected routes
  const authResponse = await authMiddleware(request);
  if (authResponse.status === 401 || authResponse.status === 403 || authResponse.headers.get('location')) {
    // Auth check failed or redirect needed
    return authResponse;
  }
  
  const response = corsResponse || authResponse || NextResponse.next();
  
  // In development, allow 'unsafe-eval' for Next.js dev tools and Sentry
  if (process.env.NODE_ENV === 'development') {
    response.headers.set(
      'Content-Security-Policy',
      "default-src 'self'; " +
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.sentry.io https://*.sentry-cdn.com https://va.vercel-scripts.com; " +
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
      "font-src 'self' https://fonts.gstatic.com data:; " +
      "img-src 'self' data: https: blob:; " +
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.sentry.io https://api.openai.com https://api.elevenlabs.io https://va.vercel-scripts.com ws://localhost:* wss://localhost:*; " +
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
      "script-src 'self' 'unsafe-inline' https://*.sentry.io https://*.sentry-cdn.com https://va.vercel-scripts.com; " +
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
      "font-src 'self' https://fonts.gstatic.com data:; " +
      "img-src 'self' data: https: blob:; " +
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.sentry.io https://api.openai.com https://api.elevenlabs.io https://va.vercel-scripts.com; " +
      "media-src 'self' blob: data:; " +
      "worker-src 'self' blob:; " +
      "child-src 'self' blob:; " +
      "frame-src 'self' https://docs.google.com;"
    );
  }
  
  // Add critical security headers for all environments
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(self), geolocation=()');
  
  // Add HSTS header for production only
  if (process.env.NODE_ENV === 'production') {
    response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
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