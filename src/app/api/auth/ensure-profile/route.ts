import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { requireAuth } from '@/lib/auth-middleware';

/**
 * Ensures a user profile exists for the authenticated user
 * Uses authenticated client that respects RLS policies
 * Called after successful authentication if profile creation failed
 */
export async function POST(request: NextRequest) {
  return requireAuth(request, async (authenticatedRequest) => {
    const user = authenticatedRequest.user;
    const supabase = createClient();

    try {
      // Check if profile exists
      const { data: existingProfile, error: selectError } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('id', user.id)
        .single();

      if (existingProfile) {
        // Profile already exists
        return NextResponse.json({ 
          success: true, 
          message: 'Profile already exists' 
        });
      }

      if (selectError && selectError.code !== 'PGRST116') {
        // Error other than "not found"
        // Only log in development
        if (process.env.NODE_ENV === 'development') {
          console.error('[ensure-profile] Error checking profile:', selectError);
        }
        return NextResponse.json(
          { error: 'Failed to check profile', details: selectError.message },
          { status: 500 }
        );
      }

      // Create new profile using authenticated client (respects RLS)
      const profileData = {
        id: user.id,
        email: user.email,
        full_name: user.user_metadata?.full_name || 
                  user.email?.split('@')[0] || 
                  'User',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { error: insertError } = await supabase
        .from('user_profiles')
        .insert(profileData);

      if (insertError) {
        // Check if it's a unique constraint violation (profile was created by another request)
        if (insertError.code === '23505') {
          return NextResponse.json({ 
            success: true, 
            message: 'Profile already exists (concurrent creation)' 
          });
        }
        
        // Only log in development
        if (process.env.NODE_ENV === 'development') {
          console.error('[ensure-profile] Error creating profile:', insertError);
        }
        return NextResponse.json(
          { error: 'Failed to create profile', details: insertError.message },
          { status: 500 }
        );
      }

      return NextResponse.json({ 
        success: true, 
        message: 'Profile created successfully' 
      });

    } catch (error) {
      // Only log in development
      if (process.env.NODE_ENV === 'development') {
        console.error('[ensure-profile] Unexpected error:', error);
      }
      return NextResponse.json(
        { error: 'An unexpected error occurred' },
        { status: 500 }
      );
    }
  });
}