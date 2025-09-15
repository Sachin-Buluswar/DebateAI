import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { withRateLimit, apiRateLimiter } from '@/middleware/rateLimiter';
import { requireAuth, AuthenticatedRequest } from '@/lib/auth-middleware';

/**
 * User preferences endpoint to handle Supabase client requests
 * This prevents 404 errors in the console
 */
export const dynamic = 'force-dynamic'; // Add this to properly mark as dynamic route

export async function GET(request: NextRequest) {
  return await withRateLimit(request, apiRateLimiter, async () => {
    return requireAuth(request, async (req: AuthenticatedRequest) => {
      try {
        const supabase = createClient();
        const user = req.user;
        
        // Get user ID from the URL
        const searchParams = request.nextUrl.searchParams;
        const userId = searchParams.get('user_id');
        
        // If userId is provided, ensure it matches the authenticated user
        if (userId && userId !== user.id) {
          return NextResponse.json({ 
            message: 'Unauthorized',
            preferences: {} 
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
        
        // Create response with proper headers for Supabase client compatibility
        const response = NextResponse.json({
          user_id: user.id,
          preferences,
          timestamp: new Date().toISOString()
        });
        
        // Add headers to satisfy Supabase client expectations
        response.headers.set('Content-Type', 'application/json');
        response.headers.set('Accept', 'application/json');
        
        return response;
      } catch (error) {
        // PRODUCTION: Logging disabled
// console.error('Error fetching user preferences:', error);
        return NextResponse.json({ 
          message: 'Error fetching preferences',
          preferences: {} 
        }, { status: 500 });
      }
    });
  });
}

export async function PUT(request: NextRequest) {
  return await withRateLimit(request, apiRateLimiter, async () => {
    return requireAuth(request, async (req: AuthenticatedRequest) => {
      try {
        const supabase = createClient();
        const user = req.user;
        
        const body = await request.json();
        const { preferences } = body;
        
        if (!preferences || typeof preferences !== 'object') {
          return NextResponse.json({
            message: 'Invalid preferences data'
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
          // PRODUCTION: Logging disabled
// console.error('Error updating user preferences:', updateError);
          return NextResponse.json({
            message: 'Failed to update preferences'
          }, { status: 500 });
        }
        
        return NextResponse.json({
          message: 'Preferences updated successfully',
          user_id: user.id,
          preferences,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        // PRODUCTION: Logging disabled
// console.error('Error updating user preferences:', error);
        return NextResponse.json({ 
          message: 'Error updating preferences'
        }, { status: 500 });
      }
    });
  });
} 