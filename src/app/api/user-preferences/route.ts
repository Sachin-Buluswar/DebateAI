import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withRateLimit, apiRateLimiter } from '@/api-middleware/rateLimiter';
import { requireAuth, AuthenticatedRequest } from '@/lib/auth-middleware';

/**
 * User preferences endpoint to handle Supabase client requests
 * This prevents 404 errors in the console
 */
export const dynamic = 'force-dynamic'; // Add this to properly mark as dynamic route

export async function GET(request: NextRequest) {
  return await withRateLimit(request, apiRateLimiter, async () => {
    return requireAuth(request, async (authenticatedReq: AuthenticatedRequest) => {
      try {
        const user = authenticatedReq.user;
        const supabase = createClient();

        // Get user ID from the URL
        const searchParams = request.nextUrl.searchParams;
        const userId = searchParams.get('user_id');

        // If userId is provided, ensure it matches the authenticated user
        if (userId && userId !== user.id) {
          return NextResponse.json({
            error: 'Unauthorized: can only access your own preferences',
          }, { status: 403 });
        }

        // Try to fetch user preferences from the user_profiles table
        const { data: profileData, error: profileError } = await supabase
          .from('user_profiles')
          .select('preferences')
          .eq('id', user.id)
          .single();

        let preferences = {
          theme: 'system',
          notifications_enabled: true,
          history_count: 10,
        };

        if (!profileError && profileData?.preferences) {
          preferences = { ...preferences, ...profileData.preferences };
        }

        return NextResponse.json({
          user_id: user.id,
          preferences,
          timestamp: new Date().toISOString()
        });
      } catch (_error) {
        return NextResponse.json({
          error: 'Failed to fetch preferences',
        }, { status: 500 });
      }
    });
  });
}

export async function PUT(request: NextRequest) {
  return await withRateLimit(request, apiRateLimiter, async () => {
    return requireAuth(request, async (authenticatedReq: AuthenticatedRequest) => {
      try {
        const user = authenticatedReq.user;
        const supabase = createClient();

        const body = await request.json();
        const { preferences } = body;

        if (!preferences || typeof preferences !== 'object') {
          return NextResponse.json({
            error: 'Invalid preferences data',
          }, { status: 400 });
        }

        // Update user preferences
        const { error: updateError } = await supabase
          .from('user_profiles')
          .upsert({
            id: user.id,
            email: user.email,
            preferences,
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'id'
          });

        if (updateError) {
          return NextResponse.json({
            error: 'Failed to update preferences',
          }, { status: 500 });
        }

        return NextResponse.json({
          user_id: user.id,
          preferences,
          timestamp: new Date().toISOString(),
        });
      } catch (_error) {
        return NextResponse.json({
          error: 'Failed to update preferences',
        }, { status: 500 });
      }
    });
  });
}