import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withRateLimit, apiRateLimiter } from '@/api-middleware/rateLimiter';
import { requireAuth, AuthenticatedRequest } from '@/lib/auth-middleware';

export async function GET(request: NextRequest) {
  return await withRateLimit(request, apiRateLimiter, async () => {
    return requireAuth(request, async (authenticatedRequest: AuthenticatedRequest) => {
      try {
        const supabase = createClient();
        const user = authenticatedRequest.user;

        const searchParams = request.nextUrl.searchParams;
        const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit') as string) : 10;
        const userId = searchParams.get('userId');

        let query = supabase.from('user_profiles').select('*');

        if (userId) {
          if (userId !== user.id) {
            const { data: hasAdminRole } = await supabase
              .rpc('check_user_role', { required_role: 'admin' });

            if (!hasAdminRole) {
              return NextResponse.json({
                error: 'Unauthorized: can only access your own profile',
              }, { status: 403 });
            }
          }
          query = query.eq('id', userId);
        } else {
          query = query.eq('id', user.id);
        }

        const { data, error } = await query.limit(limit);

        if (error) {
          return NextResponse.json({
            error: 'Failed to fetch user profiles',
          }, { status: 500 });
        }

        return NextResponse.json({
          count: data?.length || 0,
          data,
        });
      } catch (_err: unknown) {
        return NextResponse.json({
          error: 'Failed to process request',
        }, { status: 500 });
      }
    });
  });
}

export async function POST(request: NextRequest) {
  return await withRateLimit(request, apiRateLimiter, async () => {
    return requireAuth(request, async (authenticatedRequest: AuthenticatedRequest) => {
      try {
        const supabase = createClient();
        const user = authenticatedRequest.user;
        const body = await request.json();

        // Users can only create/update their own profile
        const profileId = body.id || user.id;
        if (profileId !== user.id) {
          return NextResponse.json({
            error: 'Forbidden: can only modify your own profile',
          }, { status: 403 });
        }

        const { data: existing, error: queryError } = await supabase
          .from('user_profiles')
          .select('id')
          .eq('id', user.id)
          .maybeSingle();

        if (queryError) {
          return NextResponse.json({
            error: 'Failed to check existing profile',
          }, { status: 500 });
        }

        let result;

        if (existing) {
          const { data, error } = await supabase
            .from('user_profiles')
            .update({
              display_name: body.display_name,
              preferences: body.preferences,
              updated_at: new Date().toISOString()
            })
            .eq('id', user.id)
            .select()
            .single();

          if (error) {
            return NextResponse.json({
              error: 'Failed to update user profile',
            }, { status: 500 });
          }

          result = { data, isNew: false };
        } else {
          const { data, error } = await supabase
            .from('user_profiles')
            .insert({
              id: user.id,
              display_name: body.display_name,
              preferences: body.preferences,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
            .select()
            .single();

          if (error) {
            return NextResponse.json({
              error: 'Failed to create user profile',
            }, { status: 500 });
          }

          result = { data, isNew: true };
        }

        return NextResponse.json(result);
      } catch (_err: unknown) {
        return NextResponse.json({
          error: 'Failed to process request',
        }, { status: 500 });
      }
    });
  });
}
