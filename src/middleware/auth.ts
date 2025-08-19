import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Server-side authentication middleware
 * 
 * This runs on the Edge Runtime and validates authentication
 * before requests reach page components or API routes.
 * 
 * Security benefits:
 * - Cannot be bypassed by disabling JavaScript
 * - Runs before any page rendering
 * - Protects both pages and API routes
 * - Single source of truth for auth
 * 
 * Note: Full auth verification happens in individual routes since
 * we can't use Supabase server client in Edge Runtime middleware.
 * This provides an additional layer of protection.
 */

export async function authMiddleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  
  // Define protected routes
  const protectedRoutes = [
    '/dashboard',
    '/debate',
    '/speech-feedback',
    '/history',
    '/search',
    '/preferences',
    '/feedback',
    '/learn',
    '/admin'
  ];
  
  const protectedApiRoutes = [
    '/api/debate',
    '/api/speech-feedback',
    '/api/wiki',
    '/api/user',
    '/api/admin',
    '/api/resources'
  ];
  
  // Check if current path is protected
  const isProtectedPage = protectedRoutes.some(route => pathname.startsWith(route));
  const isProtectedApi = protectedApiRoutes.some(route => pathname.startsWith(route));
  
  if (isProtectedPage || isProtectedApi) {
    // Check for auth cookies (basic check - full verification in routes)
    const cookieHeader = request.headers.get('cookie');
    
    // Look for Supabase auth cookies
    const hasAuthCookie = cookieHeader && (
      cookieHeader.includes('sb-access-token') ||
      cookieHeader.includes('sb-refresh-token') ||
      cookieHeader.includes('supabase-auth-token')
    );
    
    if (!hasAuthCookie) {
      // No auth cookies present
      if (isProtectedApi) {
        return NextResponse.json(
          { error: 'Unauthorized', message: 'Please log in to access this resource.' },
          { status: 401 }
        );
      }
      
      // For pages, redirect to auth
      const redirectUrl = new URL('/auth', request.url);
      redirectUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(redirectUrl);
    }
    
    // Additional check for admin routes
    if (pathname.startsWith('/admin') || pathname.startsWith('/api/admin')) {
      // Admin verification must happen in the actual route
      // since we can't query database from Edge Runtime
      // But we can add an extra header to indicate admin check is needed
      const response = NextResponse.next();
      response.headers.set('x-require-admin', 'true');
      return response;
    }
  }
  
  return NextResponse.next();
}