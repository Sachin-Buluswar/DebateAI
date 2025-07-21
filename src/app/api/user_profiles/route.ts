import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient();
    const searchParams = request.nextUrl.searchParams;
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit') as string) : 10;
    const userId = searchParams.get('userId');

    let query = supabase.from('user_profiles').select('*');
    
    if (userId) {
      query = query.eq('user_id', userId);
    }
    
    const { data, error } = await query.limit(limit);

    if (error) {
      console.error('Error fetching user profiles:', error);
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
    console.error('Error in user_profiles API:', err);
    return NextResponse.json({
      status: 'error',
      message: 'Error processing request',
      error: err instanceof Error ? err.message : 'An unknown error occurred'
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient();
    const body = await request.json();
    
    // Validate the request body
    if (!body.user_id) {
      return NextResponse.json({
        status: 'error',
        message: 'user_id is required'
      }, { status: 400 });
    }
    
    // Check if profile already exists
    const { data: existing, error: queryError } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('user_id', body.user_id)
      .maybeSingle();
      
    if (queryError) {
      console.error('Error checking existing profile:', queryError);
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
        .eq('user_id', body.user_id)
        .select()
        .single();
        
      if (error) {
        console.error('Error updating user profile:', error);
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
          user_id: body.user_id,
          display_name: body.display_name,
          preferences: body.preferences,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();
        
      if (error) {
        console.error('Error creating user profile:', error);
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
    console.error('Error in user_profiles API:', err);
    return NextResponse.json({
      status: 'error',
      message: 'Error processing request',
      error: err instanceof Error ? err.message : 'An unknown error occurred'
    }, { status: 500 });
  }
} 