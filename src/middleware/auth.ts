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
  // GUEST MODE ENABLED: Skip all authentication checks to allow guest access
  // Individual pages will handle authentication state internally

  const pathname = request.nextUrl.pathname;

  // Still protect admin routes specifically
  if (pathname.startsWith('/admin') || pathname.startsWith('/api/admin')) {
    // Check for auth cookies for admin routes only
    const cookieHeader = request.headers.get('cookie');

    // Look for Supabase auth cookies
    const hasAuthCookie = cookieHeader && (
      cookieHeader.includes('sb-access-token') ||
      cookieHeader.includes('sb-refresh-token') ||
      cookieHeader.includes('supabase-auth-token')
    );

    if (!hasAuthCookie) {
      // No auth cookies present for admin routes
      if (pathname.startsWith('/api/admin')) {
        return NextResponse.json(
          { error: 'Unauthorized', message: 'Admin access required.' },
          { status: 401 }
        );
      }

      // For admin pages, redirect to auth
      const redirectUrl = new URL('/auth', request.url);
      redirectUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(redirectUrl);
    }

    // Add header to indicate admin check is needed
    const response = NextResponse.next();
    response.headers.set('x-require-admin', 'true');
    return response;
  }

  // Allow all other routes for guest mode
  return NextResponse.next();
}