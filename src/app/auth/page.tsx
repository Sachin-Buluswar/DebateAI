'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Session, AuthChangeEvent } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabaseClient';
import CustomAuthForm from '@/components/auth/CustomAuthForm';
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
    const urlErrorDescription = searchParams?.get('error_description');
    
    if (urlError) {
      if (urlError === 'access_denied' && urlErrorDescription?.includes('otp_expired')) {
        setError('Email verification link has expired. Please request a new one.');
      } else {
        setError(urlErrorDescription || urlError);
      }
    }
    
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
        } catch (healthErr) {
          console.error('Supabase health check exception:', healthErr);
        }
        
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) {
          setError(`Authentication error: ${sessionError.message}`);
          setLoading(false);
          return;
        }
        
        if (session) {
          console.log('[auth] User already logged in, redirecting to dashboard');
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
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event: AuthChangeEvent, session: Session | null) => {
        console.log('[auth] Auth state changed:', event, session?.user?.email);
        
        if (event === 'SIGNED_IN' && session) {
          console.log('[auth] User signed in, redirecting to dashboard');
          router.push('/dashboard');
        } else if (event === 'SIGNED_OUT') {
          console.log('[auth] User signed out');
          setLoading(false);
        }
      }
    );
    
    return () => {
      subscription.unsubscribe();
    };
  }, [router, searchParams]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center flex-col">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-gray-600 dark:text-gray-400">Checking authentication...</p>
        {error && (
          <div className="text-red-600 bg-red-100 p-3 rounded text-sm max-w-md text-center mt-4">
            {error}
          </div>
        )}
      </div>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-6 bg-gradient-to-br from-gray-50 to-white dark:from-gray-900 dark:to-gray-800">
      <div className="bg-glass max-w-md w-full p-8 rounded-xl shadow-lg">
        <Link href="/" className="block text-center mb-6">
          <h1 className="text-4xl font-extrabold text-gray-900 dark:text-white">DebateAI</h1>
        </Link>
        <p className="text-sm text-gray-700 dark:text-gray-300 text-center mb-6">
          Sign in or create an account to get started
        </p>
        {error && (
          <div className="mb-6 p-4 rounded-md bg-red-100 dark:bg-red-900/20 border border-red-300 dark:border-red-800">
            <p className="text-red-600 dark:text-red-300 font-medium">Error: {error}</p>
            <p className="text-xs text-red-600 dark:text-red-300 mt-1">Please try again or contact support.</p>
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
      <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
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