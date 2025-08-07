'use client';

import Layout from '@/components/layout/Layout';
import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { LoadingSpinner } from '@/components/LoadingSpinner';

export default function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    // Check authentication status
    const checkAuth = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Auth check error:', error);
          router.push('/auth');
          return;
        }

        if (!session) {
          console.log('No session found, redirecting to auth');
          router.push('/auth');
          return;
        }

        setAuthenticated(true);
        setLoading(false);
      } catch (error) {
        console.error('Error checking authentication:', error);
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