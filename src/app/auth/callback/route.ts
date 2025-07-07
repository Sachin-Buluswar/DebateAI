import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const error = requestUrl.searchParams.get('error')
  const errorDescription = requestUrl.searchParams.get('error_description')

  if (error) {
    console.error('[auth-callback] Authentication error:', error, errorDescription)
    // Redirect to auth page with error
    return NextResponse.redirect(`${requestUrl.origin}/auth?error=${encodeURIComponent(error)}&error_description=${encodeURIComponent(errorDescription || '')}`)
  }

  if (code) {
    const cookieStore = cookies()
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
    
    try {
      const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
      
      if (exchangeError) {
        console.error('[auth-callback] Code exchange error:', exchangeError)
        return NextResponse.redirect(`${requestUrl.origin}/auth?error=${encodeURIComponent(exchangeError.message)}`)
      }

      if (data.session) {
        console.log('[auth-callback] Authentication successful for user:', data.user?.email)
        
        // Create user profile if it doesn't exist
        if (data.user) {
          const { error: profileError } = await supabase
            .from('user_profiles')
            .upsert({
              id: data.user.id,
              email: data.user.email,
              full_name: data.user.user_metadata?.full_name || data.user.email?.split('@')[0] || 'User',
              updated_at: new Date().toISOString()
            }, {
              onConflict: 'id'
            })

          if (profileError) {
            console.warn('[auth-callback] Profile creation warning:', profileError)
            // Don't fail auth for profile creation issues
          }
        }

        // Redirect to dashboard on successful authentication
        return NextResponse.redirect(`${requestUrl.origin}/dashboard`)
      }
    } catch (error) {
      console.error('[auth-callback] Unexpected error:', error)
      return NextResponse.redirect(`${requestUrl.origin}/auth?error=${encodeURIComponent('Authentication failed')}`)
    }
  }

  // No code or error, redirect to auth page
  return NextResponse.redirect(`${requestUrl.origin}/auth`)
} 