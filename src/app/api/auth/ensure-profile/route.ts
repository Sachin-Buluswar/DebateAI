import { createClient } from '@/utils/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

/**
 * Ensures a user profile exists for the authenticated user
 * This endpoint uses the service role key to bypass RLS policies
 * Called after successful authentication if profile creation failed
 */
export async function POST(_request: NextRequest) {
  try {
    // Get the current user session
    const supabase = createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }
    
    // Check if profile already exists
    const { data: existingProfile } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('id', user.id)
      .single();
    
    if (existingProfile) {
      return NextResponse.json(
        { message: 'Profile already exists' },
        { status: 200 }
      );
    }
    
    // Create profile using service role client if available
    if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const serviceClient = createServiceClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
        {
          auth: {
            autoRefreshToken: false,
            persistSession: false
          }
        }
      );
      
      const profileData = {
        id: user.id,
        email: user.email!,
        full_name: user.user_metadata?.full_name || 
                  user.email?.split('@')[0] || 
                  'User',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      const { error: insertError } = await serviceClient
        .from('user_profiles')
        .insert(profileData);
      
      if (insertError) {
        // Try with regular client as fallback
        const { error: fallbackError } = await supabase
          .from('user_profiles')
          .insert(profileData);
        
        if (fallbackError) {
          return NextResponse.json(
            { error: 'Failed to create profile' },
            { status: 500 }
          );
        }
      }
      
      return NextResponse.json(
        { message: 'Profile created successfully' },
        { status: 201 }
      );
    } else {
      // No service role key, try with regular client
      const profileData = {
        id: user.id,
        email: user.email!,
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
        return NextResponse.json(
          { error: 'Failed to create profile' },
          { status: 500 }
        );
      }
      
      return NextResponse.json(
        { message: 'Profile created successfully' },
        { status: 201 }
      );
    }
  } catch (_error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}