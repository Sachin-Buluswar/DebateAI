'use client';

import Layout from '@/components/layout/Layout';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { LoadingSpinner } from '@/components/LoadingSpinner';

export default function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    // Check authentication status
    const checkAuth = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          // PRODUCTION: Console disabled
          // console.error('Auth check error:', error);
          router.push('/auth');
          return;
        }

        if (!session) {
          // PRODUCTION: Console disabled
          // console.log('No session found, redirecting to auth');
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
              console.warn('[layout] Profile creation deferred - will retry on next visit');
            }
          } catch (ensureError) {
            console.warn('[layout] Could not ensure profile exists:', ensureError);
            // Don't block authentication - profile will be created later
          }
        }

        setAuthenticated(true);
        setLoading(false);
      } catch (_error) {
        // PRODUCTION: Console disabled
        // console.error('Error checking authentication:', error);
        router.push('/auth');
      }
    };

    checkAuth();

    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || !session) {
        router.push('/auth');
      } else if (event === 'SIGNED_IN' && session) {
        setAuthenticated(true);
        setLoading(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [router]);

  // Show loading spinner while checking auth
  if (loading) {
    return <LoadingSpinner fullScreen text="Checking authentication..." />;
  }

  // Only render children if authenticated
  if (!authenticated) {
    return null;
  }

  // Wrap all authenticated pages with the Layout component
  return <Layout>{children}</Layout>;
}