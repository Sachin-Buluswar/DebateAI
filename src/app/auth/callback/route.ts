import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { authLogger } from '@/lib/monitoring/logger';

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const error = requestUrl.searchParams.get('error');
  const errorDescription = requestUrl.searchParams.get('error_description');

  // Handle Supabase auth errors with specific messages
  if (error) {
    let errorCode = 'auth_error';
    let errorMessage = 'authentication_failed';

    if (error === 'access_denied') {
      if (errorDescription?.includes('expired')) {
        errorCode = 'link_expired';
        errorMessage = 'verification_link_expired';
      } else {
        errorCode = 'access_denied';
        errorMessage = 'access_denied';
      }
    } else if (error === 'invalid_request') {
      errorCode = 'invalid_request';
      errorMessage = 'invalid_auth_request';
    }

    return NextResponse.redirect(
      `${requestUrl.origin}/auth?error=${errorMessage}&code=${errorCode}`
    );
  }

  if (code) {
    const supabase = createClient();

    try {
      // Exchange the code for a session
      const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

      if (exchangeError) {
        // Specific error handling for code exchange failures
        let errorCode = 'exchange_failed';
        let errorMessage = 'session_creation_failed';

        if (exchangeError.message?.includes('expired')) {
          errorCode = 'code_expired';
          errorMessage = 'auth_code_expired';
        } else if (exchangeError.message?.includes('invalid')) {
          errorCode = 'invalid_code';
          errorMessage = 'invalid_auth_code';
        }

        return NextResponse.redirect(
          `${requestUrl.origin}/auth?error=${errorMessage}&code=${errorCode}`
        );
      }

      if (data.session && data.user) {
        // Attempt to create/update user profile, but don't fail auth if it fails
        try {
          // First check if user exists in user_profiles
          const { data: existingProfile } = await supabase
            .from('user_profiles')
            .select('id')
            .eq('id', data.user.id)
            .single();

          if (!existingProfile) {
            // Create new profile using service role if available
            const profileData = {
              id: data.user.id,
              email: data.user.email,
              full_name:
                data.user.user_metadata?.full_name || data.user.email?.split('@')[0] || 'User',
              updated_at: new Date().toISOString(),
            };

            // Try to insert the profile
            const { error: insertError } = await supabase.from('user_profiles').insert(profileData);

            if (insertError) {
              // Log but don't fail - profile will be created on first dashboard visit
              authLogger.warn('Profile creation deferred', {
                service: 'auth-callback',
                metadata: { errorCode: insertError.code },
              });
            }
          } else {
            // Update existing profile
            const { error: updateError } = await supabase
              .from('user_profiles')
              .update({
                updated_at: new Date().toISOString(),
              })
              .eq('id', data.user.id);

            if (updateError) {
              authLogger.warn('Profile update deferred', {
                service: 'auth-callback',
                metadata: { errorCode: updateError.code },
              });
            }
          }
        } catch (_profileError) {
          // Profile operations failed but auth succeeded - continue
          authLogger.warn('Profile operation skipped', { service: 'auth-callback' });
        }

        // Redirect to dashboard on successful authentication
        return NextResponse.redirect(`${requestUrl.origin}/dashboard`);
      }

      // Session creation failed for unknown reason
      return NextResponse.redirect(
        `${requestUrl.origin}/auth?error=session_failed&code=no_session`
      );
    } catch (error) {
      // Unexpected error - provide a more specific message
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      authLogger.error(
        'Unexpected error in auth callback',
        error instanceof Error ? error : undefined,
        { service: 'auth-callback', metadata: { errorMessage } }
      );

      return NextResponse.redirect(
        `${requestUrl.origin}/auth?error=unexpected_error&code=system_error`
      );
    }
  }

  // No code or error, redirect to auth page
  return NextResponse.redirect(`${requestUrl.origin}/auth`);
}
