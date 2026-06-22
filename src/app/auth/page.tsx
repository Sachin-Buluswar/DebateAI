'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Session, AuthChangeEvent } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabaseClient';
import CustomAuthForm from '@/components/auth/CustomAuthForm';
import AlertMessage from '@/components/ui/AlertMessage';
import './auth.css';

function AuthPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [isClient, setIsClient] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setIsClient(true);

    // Check for error parameters from URL (from callback redirects)
    const urlError = searchParams?.get('error');
    const errorCode = searchParams?.get('code');
    const urlErrorDescription = searchParams?.get('error_description');

    if (urlError) {
      // Map error codes to user-friendly messages
      const errorMessages: Record<string, string> = {
        verification_link_expired:
          'Your email verification link has expired. Please sign up again to receive a new link.',
        auth_code_expired: 'The authentication code has expired. Please try signing in again.',
        invalid_auth_code: 'Invalid authentication code. Please try signing in again.',
        session_creation_failed: 'Unable to create session. Please try signing in again.',
        access_denied: 'Access denied. Please check your credentials and try again.',
        invalid_auth_request: 'Invalid authentication request. Please try again.',
        session_failed: 'Failed to establish session. Please try signing in again.',
        unexpected_error:
          'An unexpected error occurred. Please try again or contact support if the issue persists.',
        authentication_failed:
          'Authentication failed. Please check your credentials and try again.',
      };

      // Use specific message if available, otherwise use generic message
      const message =
        errorMessages[urlError] ||
        urlErrorDescription ||
        `Authentication error: ${urlError}. Please try again or contact support.`;

      setError(message);

      // Log error code for debugging (only in development)
      if (process.env.NODE_ENV === 'development' && errorCode) {
      }
    }

    // Add timeout to prevent infinite loading
    const timeoutId = setTimeout(() => {
      if (loading) {
        setLoading(false);
        // Don't set error - just show the login form
      }
    }, 3000); // 3 second timeout

    // Check if user is already logged in
    const checkUser = async () => {
      try {
        // Test the Supabase connection first
        try {
          // First try the health_check table
          const { error: healthError } = await supabase
            .from('health_check')
            .select('status')
            .limit(1)
            .single();

          if (healthError) {
            // Fallback to user_profiles table
            const { error: profileError } = await supabase
              .from('user_profiles')
              .select('count')
              .limit(1);

            if (profileError) {
              setError(`Database connection error: ${profileError.message}`);
              setLoading(false);
              return;
            }
          }
        } catch {}

        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();
        if (userError) {
          // User not authenticated is expected on auth page, only show real errors
          if (userError.message !== 'Auth session missing!' && userError.status !== 401) {
            setError(`Authentication error: ${userError.message}`);
          }
          setLoading(false);
          return;
        }

        if (user) {
          router.push('/dashboard');
          return;
        } else {
          setLoading(false);
        }
      } catch (error) {
        setError(`Unexpected error: ${error instanceof Error ? error.message : String(error)}`);
        setLoading(false);
      }
    };

    checkUser();

    // Set up auth state listener
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event: AuthChangeEvent, session: Session | null) => {
      if (event === 'SIGNED_IN' && session) {
        router.push('/dashboard');
      } else if (event === 'SIGNED_OUT') {
        setLoading(false);
      }
    });

    // Clean up both timeout and subscription
    return () => {
      clearTimeout(timeoutId);
      subscription.unsubscribe();
    };
  }, [router, searchParams]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center flex-col">
        <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-gray-600 dark:text-gray-400">Checking authentication...</p>
        {error && (
          <div className="max-w-md mt-4">
            <AlertMessage type="error" message={error} />
          </div>
        )}
      </div>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-6 bg-gradient-to-br from-gray-50 to-white dark:from-gray-900 dark:to-gray-800">
      <div className="bg-white dark:bg-gray-800 max-w-md w-full p-8 rounded-xl shadow-lg">
        <Link href="/" className="block text-center mb-6">
          <h1 className="text-4xl font-extrabold text-gray-900 dark:text-white">Eris Debate</h1>
        </Link>
        <p className="text-sm text-gray-700 dark:text-gray-300 text-center mb-6">
          Sign in or create an account to get started
        </p>
        {error && (
          <div className="mb-6">
            <AlertMessage type="error" message={error} />
          </div>
        )}
        {isClient && <CustomAuthForm />}
      </div>
    </main>
  );
}

function LoadingFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
    </div>
  );
}

export default function AuthPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <AuthPageContent />
    </Suspense>
  );
}
