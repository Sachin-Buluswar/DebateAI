'use client';

import { useState, useEffect } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useRouter } from 'next/navigation';
import EnhancedInput from '@/components/ui/EnhancedInput';
import EnhancedButton from '@/components/ui/EnhancedButton';

export default function CustomAuthForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [emailExists, setEmailExists] = useState(false);
  
  const supabase = createClientComponentClient();
  const router = useRouter();

  // Clear error and message when switching forms
  useEffect(() => {
    setError(null);
    setMessage(null);
    setEmailExists(false);
  }, [isSignUp, showForgotPassword]);

  // Check if email exists when user types in sign up mode
  useEffect(() => {
    const checkEmailExists = async () => {
      if (!isSignUp || !email || email.length < 5) {
        setEmailExists(false);
        return;
      }

      try {
        // Use the sign in method to check if email exists
        // This will fail if email doesn't exist, succeed if it does
        const { error } = await supabase.auth.signInWithPassword({
          email: email,
          password: 'dummy-password-for-checking' // This will fail but that's ok
        });

        // If error is "Invalid login credentials", the email exists
        // If error is "User not found" or similar, the email doesn't exist
        if (error && error.message.includes('Invalid login credentials')) {
          setEmailExists(true);
        } else {
          setEmailExists(false);
        }
      } catch (error) {
        // If there's an exception, assume email doesn't exist
        setEmailExists(false);
      }
    };

    const timeoutId = setTimeout(checkEmailExists, 500); // Debounce
    return () => clearTimeout(timeoutId);
  }, [email, isSignUp, supabase]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setMessage(null);

    // Client-side validation for password length
    if (!showForgotPassword && password.length < 6) {
      setError('Invalid email or password. Please check your credentials and try again.');
      setIsLoading(false);
      return;
    }

    try {
      if (showForgotPassword) {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/auth/reset-password`,
        });
        
        if (error) throw error;
        
        setMessage('Password reset email sent! Please check your inbox.');
        setShowForgotPassword(false);
      } else if (isSignUp) {
        // Check if email already exists before attempting sign up
        if (emailExists) {
          setError('This email address is already associated with an account. Please sign in instead.');
          setIsSignUp(false); // Switch to sign in mode
          return;
        }

        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        });
        
        if (error) {
          // Handle specific error for existing email
          if (error.message.includes('already registered')) {
            setError('This email address is already associated with an account. Please sign in instead.');
            setIsSignUp(false); // Switch to sign in mode
            return;
          }
          throw error;
        }
        
        if (data.user && !data.session) {
          setMessage('Please check your email to confirm your account before signing in!');
        } else if (data.session) {
          // Auto-signed in (email confirmation disabled)
          console.log('[auth] Sign up successful, redirecting to dashboard');
          router.push('/dashboard');
          router.refresh();
        }
      } else {
        console.log('[auth] Attempting sign in for:', email);
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        
        if (error) {
          console.error('[auth] Sign in error:', error);
          throw error;
        }
        
        if (data.session) {
          console.log('[auth] Sign in successful, redirecting to dashboard');
          router.push('/dashboard');
          router.refresh();
        } else {
          throw new Error('Sign in failed - no session created');
        }
      }
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error('An unknown error occurred');
      console.error('[auth] Authentication error:', error);
      
      // Provide more user-friendly error messages
      let friendlyMessage = error.message;
      if (error.message.includes('Invalid login credentials')) {
        friendlyMessage = 'Invalid email or password. Please check your credentials and try again.';
      } else if (error.message.includes('Email not confirmed')) {
        friendlyMessage = 'Please check your email and click the confirmation link before signing in.';
      } else if (error.message.includes('Too many requests')) {
        friendlyMessage = 'Too many attempts. Please wait a moment and try again.';
      }
      
      setError(friendlyMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      console.log('[auth] Attempting Google sign in');
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      
      if (error) throw error;
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error('An unknown error occurred');
      console.error('[auth] Google sign in error:', error);
      setError(`Google sign-in failed: ${error.message}`);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto">
      <form onSubmit={handleAuth} className="space-y-6">
        <div>
          <EnhancedInput
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={isLoading}
            label="Email"
            placeholder="Enter your email"
            icon={
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} 
                  d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            }
          />
          {isSignUp && emailExists && (
            <div className="mt-2 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-300 dark:border-blue-800">
              <p className="text-blue-600 dark:text-blue-300 text-sm flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} 
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                This email address is already associated with an account.
                <button
                  type="button"
                  onClick={() => setIsSignUp(false)}
                  className="ml-1 underline hover:no-underline font-medium"
                >
                  Sign in instead
                </button>
              </p>
            </div>
          )}
        </div>

        {!showForgotPassword && (
          <div className="relative">
            <EnhancedInput
              id="password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={isLoading}
              label="Password"
              placeholder="Enter your password"
              icon={
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} 
                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              }
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute top-8 right-3 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              tabIndex={-1}
            >
              {showPassword ? (
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              ) : (
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                </svg>
              )}
            </button>
          </div>
        )}

        {error && (
          <div className="p-4 bg-red-50 dark:bg-red-900/20 border-l-2 border-l-red-500" style={{ borderRadius: 0 }}>
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} 
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <p className="text-red-800 dark:text-red-200 text-sm flex-1">{error}</p>
            </div>
          </div>
        )}

        {message && (
          <div className="p-4 bg-green-50 dark:bg-green-900/20 border-l-2 border-l-[#87A96B]" style={{ borderRadius: 0 }}>
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-[#87A96B] flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} 
                  d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-green-800 dark:text-green-200 text-sm flex-1">{message}</p>
            </div>
          </div>
        )}

        <EnhancedButton
          type="submit"
          loading={isLoading}
          variant="primary"
          size="lg"
          className="w-full"
        >
          {showForgotPassword ? 'Send Reset Email' : isSignUp ? 'Sign Up' : 'Sign In'}
        </EnhancedButton>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-300 dark:border-gray-600" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-white dark:bg-gray-800 text-gray-500">Or continue with</span>
          </div>
        </div>

        <EnhancedButton
          type="button"
          onClick={handleGoogleSignIn}
          loading={isLoading}
          variant="outline"
          size="lg"
          className="w-full"
          icon={
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                fill="currentColor"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="currentColor"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="currentColor"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="currentColor"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
          }
        >
          Sign in with Google
        </EnhancedButton>

        <div className="text-center space-y-2">
          {!showForgotPassword && (
            <>
              <EnhancedButton
                type="button"
                onClick={() => setIsSignUp(!isSignUp)}
                disabled={isLoading}
                variant="ghost"
                size="sm"
                className="text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300"
              >
                {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
              </EnhancedButton>
              <br />
              <EnhancedButton
                type="button"
                onClick={() => setShowForgotPassword(true)}
                disabled={isLoading}
                variant="ghost"
                size="sm"
                className="text-gray-600 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
              >
                Forgot your password?
              </EnhancedButton>
            </>
          )}
          {showForgotPassword && (
            <EnhancedButton
              type="button"
              onClick={() => setShowForgotPassword(false)}
              disabled={isLoading}
              variant="ghost"
              size="sm"
              className="text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300"
            >
              Back to Sign In
            </EnhancedButton>
          )}
        </div>
      </form>
    </div>
  );
} 