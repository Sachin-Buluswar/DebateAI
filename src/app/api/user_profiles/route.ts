import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { withRateLimit, apiRateLimiter } from '@/middleware/rateLimiter';
import { requireAuth, AuthenticatedRequest } from '@/lib/auth-middleware';

export async function GET(request: NextRequest) {
  return await withRateLimit(request, apiRateLimiter, async () => {
    return requireAuth(request, async (req: AuthenticatedRequest) => {
      try {
        const supabase = createClient();
        const user = req.user;
        
        const searchParams = request.nextUrl.searchParams;
        const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit') as string) : 10;
        const userId = searchParams.get('userId');

        // Users can only fetch their own profile unless they have admin role
        let query = supabase.from('user_profiles').select('*');
        
        if (userId) {
          // Check if requesting user's own profile or has admin role
          if (userId !== user.id) {
            // Check for admin role
            const { data: hasAdminRole } = await supabase
              .rpc('check_user_role', { required_role: 'admin' });
            
            if (!hasAdminRole) {
              return NextResponse.json({
                status: 'error',
                message: 'Unauthorized: Can only access your own profile'
              }, { status: 403 });
            }
          }
          query = query.eq('id', userId);
        } else {
          // If no userId specified, only return the current user's profile
          query = query.eq('id', user.id);
        }
        
        const { data, error } = await query.limit(limit);

        if (error) {
          // PRODUCTION: Logging disabled
// console.error('Error fetching user profiles:', error);
          return NextResponse.json({
            status: 'error',
            message: 'Failed to fetch user profiles',
            error: error.message
          }, { status: 500 });
        }

        return NextResponse.json({
          status: 'success',
          count: data?.length || 0,
          data
        });
      } catch (err: unknown) {
        // PRODUCTION: Logging disabled
// console.error('Error in user_profiles API:', err);
        return NextResponse.json({
          status: 'error',
          message: 'Error processing request',
          error: err instanceof Error ? err.message : 'An unknown error occurred'
        }, { status: 500 });
      }
    });
  });
}

export async function POST(request: NextRequest) {
  return await withRateLimit(request, apiRateLimiter, async () => {
    return requireAuth(request, async (req: AuthenticatedRequest) => {
      try {
        const supabase = createClient();
        const user = req.user;
        const body = await request.json();
        
        // Validate the request body
        if (!body.id) {
          return NextResponse.json({
            status: 'error',
            message: 'id is required'
          }, { status: 400 });
        }
        
        // Verify the user can only modify their own profile
        if (body.id !== user.id) {
          return NextResponse.json({
            status: 'error',
            message: 'Forbidden - Cannot modify another user\'s profile'
          }, { status: 403 });
        }
        
        // Check if profile already exists
        const { data: existing, error: queryError } = await supabase
          .from('user_profiles')
          .select('id')
          .eq('id', body.id)
          .maybeSingle();
          
        if (queryError) {
          // PRODUCTION: Logging disabled
// console.error('Error checking existing profile:', queryError);
          return NextResponse.json({
            status: 'error',
            message: 'Error checking existing profile',
            error: queryError.message
          }, { status: 500 });
        }
        
        let result;
        
        if (existing) {
          // Update existing profile
          const { data, error } = await supabase
            .from('user_profiles')
            .update({
              display_name: body.display_name,
              preferences: body.preferences,
              updated_at: new Date().toISOString()
            })
            .eq('id', body.id)
            .select()
            .single();
            
          if (error) {
            // PRODUCTION: Logging disabled
// console.error('Error updating user profile:', error);
            return NextResponse.json({
              status: 'error',
              message: 'Failed to update user profile',
              error: error.message
            }, { status: 500 });
          }
          
          result = { data, isNew: false };
        } else {
          // Create new profile
          const { data, error } = await supabase
            .from('user_profiles')
            .insert({
              id: body.id,
              display_name: body.display_name,
              preferences: body.preferences,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
            .select()
            .single();
            
          if (error) {
            // PRODUCTION: Logging disabled
// console.error('Error creating user profile:', error);
            return NextResponse.json({
              status: 'error',
              message: 'Failed to create user profile',
              error: error.message
            }, { status: 500 });
          }
          
          result = { data, isNew: true };
        }
        
        return NextResponse.json({
          status: 'success',
          ...result
        });
      } catch (err: unknown) {
        // PRODUCTION: Logging disabled
// console.error('Error in user_profiles API:', err);
        return NextResponse.json({
          status: 'error',
          message: 'Error processing request',
          error: err instanceof Error ? err.message : 'An unknown error occurred'
        }, { status: 500 });
      }
    });
  });
} 