import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

/**
 * Health check endpoint to verify connection to Supabase
 * This helps prevent 404 errors in console when Supabase client checks for health
 */
export async function GET(): Promise<NextResponse> {
  try {
    // Try to connect to Supabase
    const { data, error } = await supabase
      .from('health_check')
      .select('*')
      .limit(1)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') { // PGRST116 is "relation does not exist" which is fine
      // There was an error (other than table not existing)
      return NextResponse.json({
        status: 'error',
        message: 'Failed to connect to Supabase',
        error: error.message,
        code: error.code,
        details: error.details
      }, { status: 500 });
    }

    // Try a second check with a different table
    const { data: userData, error: userError } = await supabase
      .from('user_profiles')
      .select('*')
      .limit(1);

    if (userError && userError.code !== 'PGRST116') {
      return NextResponse.json({
        status: 'partial',
        message: 'Connected to Supabase but user_profiles table check failed',
        error: userError.message,
        code: userError.code,
        details: userError.details
      }, { status: 207 });
    }

    return NextResponse.json({
      status: 'success',
      message: 'Successfully connected to Supabase',
      health_check: data ? 'table exists' : 'table does not exist',
      user_profiles: userData ? `found ${userData.length} records` : 'table does not exist or is empty'
    });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : "An unknown error occurred";
    console.error('Health check error:', err);
    return NextResponse.json({
      status: 'error',
      message: 'Error performing health check',
      error: errorMessage
    }, { status: 500 });
  }
} 