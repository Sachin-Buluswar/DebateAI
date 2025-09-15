'use client';

import Layout from '@/components/layout/Layout';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { LoadingSpinner } from '@/components/LoadingSpinner';

export default function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Create Supabase client once per component lifecycle
  const supabase = createClient();

  const checkAuth = useCallback(async () => {
    try {
      // Add timeout to prevent infinite loading
      const timeoutId = setTimeout(() => {
        setAuthError('Authentication check timed out. Please refresh the page.');
        setLoading(false);
      }, 10000); // 10 second timeout

      const { data: { session }, error } = await supabase.auth.getSession();
      clearTimeout(timeoutId);
        
      if (error) {
        // PRODUCTION: Console disabled
        // console.error('Auth check error:', error);
        setAuthError(error.message);
        setLoading(false);
        router.push('/auth');
        return;
      }

      if (!session) {
        // PRODUCTION: Console disabled
        // console.log('No session found, redirecting to auth');
        setLoading(false);
        router.push('/auth');
        return;
      }

      // Check if user profile exists
      const { data: profile, error: profileError } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('id', session.user.id)
        .single();

      // If profile doesn't exist or there's an error fetching it, try to create it
      if (!profile || profileError) {
        try {
          const response = await fetch('/api/auth/ensure-profile', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
          });

          if (!response.ok) {
            // Only log in development
            if (process.env.NODE_ENV === 'development') {
              console.warn('[layout] Profile creation deferred - will retry on next visit');
            }
          }
        } catch (ensureError) {
          // Only log in development
          if (process.env.NODE_ENV === 'development') {
            console.warn('[layout] Could not ensure profile exists:', ensureError);
          }
          // Don't block authentication - profile will be created later
        }
      }

      // Always set authenticated and loading state after checks complete
      setAuthenticated(true);
      setAuthError(null);
      setLoading(false);
    } catch (error) {
      // PRODUCTION: Console disabled
      // console.error('Error checking authentication:', error);
      const errorMessage = error instanceof Error ? error.message : 'Authentication check failed';
      setAuthError(errorMessage);
      setLoading(false);
      router.push('/auth');
    }
  }, [router, supabase]);

  useEffect(() => {
    // Run auth check immediately
    checkAuth();

    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        // User signed out - clear state and redirect
        setAuthenticated(false);
        setAuthError(null);
        setLoading(false);
        router.push('/auth');
      } else if (event === 'SIGNED_IN' && session) {
        // User signed in, update state and re-check auth
        checkAuth();
      } else if (event === 'TOKEN_REFRESHED' && session) {
        // Token refreshed, keep authenticated
        setAuthenticated(true);
        setAuthError(null);
        setLoading(false);
      } else if (event === 'USER_UPDATED' && !session) {
        // User session ended (e.g., deleted account)
        setAuthenticated(false);
        setAuthError(null);
        setLoading(false);
        router.push('/auth');
      }
      // Don't redirect on other events to prevent race conditions
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [checkAuth, router, supabase]);

  // Show loading spinner while checking auth
  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center">
        <LoadingSpinner fullScreen text="Checking authentication..." />
        {authError && (
          <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg max-w-md">
            <p className="text-red-600 dark:text-red-400 text-sm">{authError}</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-2 text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 text-sm underline"
            >
              Refresh page
            </button>
          </div>
        )}
      </div>
    );
  }

  // Only render children if authenticated
  if (!authenticated) {
    return null;
  }

  // Wrap all authenticated pages with the Layout component
  return <Layout>{children}</Layout>;
}