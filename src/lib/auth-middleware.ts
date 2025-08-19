/**
 * Centralized Authentication Middleware
 * 
 * Provides consistent authentication and authorization checks across all API routes.
 * This replaces the scattered auth implementations with a single source of truth.
 * 
 * Security principles:
 * - Always use server-side authentication checks
 * - Never trust client-side auth state
 * - Use RLS-respecting authenticated client
 * - Fail securely (deny by default)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { User } from '@supabase/supabase-js';

export interface AuthenticatedRequest extends NextRequest {
  user: User;
}

/**
 * Require authentication for a route
 * Returns 401 if user is not authenticated
 */
export async function requireAuth(
  request: NextRequest,
  handler: (request: AuthenticatedRequest) => Promise<NextResponse | Response>
): Promise<NextResponse | Response> {
  try {
    const supabase = createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    
    if (error || !user) {
      return NextResponse.json(
        { 
          error: 'Unauthorized',
          message: 'Please log in to access this resource.'
        },
        { status: 401 }
      );
    }
    
    // Attach user to request for handler to use
    (request as AuthenticatedRequest).user = user;
    
    return handler(request as AuthenticatedRequest);
  } catch (error) {
    console.error('[auth-middleware] Error checking authentication:', error);
    return NextResponse.json(
      { 
        error: 'Authentication error',
        message: 'An error occurred while verifying authentication.'
      },
      { status: 500 }
    );
  }
}

/**
 * Require admin role for a route
 * Returns 401 if not authenticated, 403 if not admin
 */
export async function requireAdmin(
  request: NextRequest,
  handler: (request: AuthenticatedRequest) => Promise<NextResponse | Response>
): Promise<NextResponse | Response> {
  try {
    const supabase = createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    
    if (error || !user) {
      return NextResponse.json(
        { 
          error: 'Unauthorized',
          message: 'Please log in to access this resource.'
        },
        { status: 401 }
      );
    }
    
    // Check admin role
    const { data: roleData, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single();
    
    if (roleError || !roleData) {
      // User has no role assigned - not an admin
      return NextResponse.json(
        { 
          error: 'Forbidden',
          message: 'You do not have permission to access this resource.'
        },
        { status: 403 }
      );
    }
    
    if (roleData.role !== 'admin' && roleData.role !== 'super_admin') {
      return NextResponse.json(
        { 
          error: 'Forbidden',
          message: 'Admin access required for this resource.'
        },
        { status: 403 }
      );
    }
    
    (request as AuthenticatedRequest).user = user;
    return handler(request as AuthenticatedRequest);
  } catch (error) {
    console.error('[auth-middleware] Error checking admin role:', error);
    return NextResponse.json(
      { 
        error: 'Authorization error',
        message: 'An error occurred while verifying permissions.'
      },
      { status: 500 }
    );
  }
}

/**
 * Optional authentication - allows both authenticated and unauthenticated access
 * but provides user info if authenticated
 */
export async function optionalAuth(
  request: NextRequest,
  handler: (request: NextRequest & { user?: User }) => Promise<NextResponse | Response>
): Promise<NextResponse | Response> {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    // Attach user if authenticated, but don't fail if not
    if (user) {
      (request as any).user = user;
    }
    
    return handler(request as NextRequest & { user?: User });
  } catch (error) {
    // Log error but continue without auth
    console.error('[auth-middleware] Error checking optional auth:', error);
    return handler(request);
  }
}

/**
 * Block an endpoint temporarily for security reasons
 */
export function blockEndpoint(
  reason: string = 'This endpoint is temporarily disabled for security updates.'
): NextResponse {
  return NextResponse.json(
    { 
      error: 'Service Unavailable',
      message: reason,
      status: 503
    },
    { status: 503 }
  );
}

/**
 * Helper to check if a user has a specific role
 */
export async function hasRole(
  userId: string, 
  requiredRole: 'user' | 'moderator' | 'admin' | 'super_admin'
): Promise<boolean> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .single();
    
    if (error || !data) return false;
    
    // Check role hierarchy
    const roleHierarchy = {
      'user': 1,
      'moderator': 2,
      'admin': 3,
      'super_admin': 4
    };
    
    const userRoleLevel = roleHierarchy[data.role as keyof typeof roleHierarchy] || 0;
    const requiredRoleLevel = roleHierarchy[requiredRole] || 999;
    
    return userRoleLevel >= requiredRoleLevel;
  } catch (error) {
    console.error('[auth-middleware] Error checking role:', error);
    return false;
  }
}

/**
 * Rate limit with authentication context
 */
export async function requireAuthWithRateLimit(
  request: NextRequest,
  rateLimiter: any,
  handler: (request: AuthenticatedRequest) => Promise<NextResponse | Response>
): Promise<NextResponse | Response> {
  // First check rate limit
  const { withRateLimit } = await import('@/middleware/rateLimiter');
  
  return withRateLimit(request, rateLimiter, async () => {
    // Then check auth
    return requireAuth(request, handler);
  });
}