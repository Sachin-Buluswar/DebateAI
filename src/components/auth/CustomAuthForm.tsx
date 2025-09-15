'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import EnhancedInput from '@/components/ui/EnhancedInput';
import EnhancedButton from '@/components/ui/EnhancedButton';
import { getAuthCallbackUrl, getPasswordResetUrl } from '@/lib/auth-helpers';

interface CustomAuthFormProps {
  redirectTo?: string;
}

export default function CustomAuthForm({ redirectTo = '/dashboard' }: CustomAuthFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  const supabase = createClient();

  // Clear error and message when switching forms
  useEffect(() => {
    setError(null);
    setMessage(null);
  }, [isSignUp, showForgotPassword]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Prevent double submission
    if (isLoading) {
      return;
    }
    
    setIsLoading(true);
    setError(null);
    setMessage(null);
    
    // Debug logging in development
    if (process.env.NODE_ENV === 'development') {
      console.log('[auth] Form submitted:', { email, passwordLength: password.length, isSignUp, showForgotPassword });
    }

    // Client-side validation for password length
    if (!showForgotPassword && password.length < 6) {
      setError('Invalid email or password. Please check your credentials and try again.');
      setIsLoading(false);
      return;
    }

    try {
      if (showForgotPassword) {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: getPasswordResetUrl(),
        });
        
        if (error) throw error;
        
        setMessage('If an account exists with this email, you will receive a password reset link. Please check your inbox.');
        setShowForgotPassword(false);
        // Clear form
        setEmail('');
        setPassword('');
      } else if (isSignUp) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: getAuthCallbackUrl(redirectTo),
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
          // PRODUCTION: Logging disabled
          // console.log('[auth] Sign up successful, redirecting to dashboard');
          
          // Wait briefly for auth state to propagate, then use router for clean navigation
          setTimeout(() => {
            router.push(redirectTo);
            router.refresh();
          }, 100);
        }
      } else {
        // PRODUCTION: Logging disabled
        // console.log('[auth] Attempting sign in for:', email);
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        
        if (error) {
          // PRODUCTION: Logging disabled
          // console.error('[auth] Sign in error:', error);
          throw error;
        }
        
        if (data.session) {
          // PRODUCTION: Logging disabled
          // console.log('[auth] Sign in successful, redirecting to dashboard');
          
          // Wait briefly for auth state to propagate, then use router for clean navigation
          setTimeout(() => {
            router.push(redirectTo);
            router.refresh();
          }, 100);
        } else {
          throw new Error('Sign in failed - no session created');
        }
      }
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error('An unknown error occurred');
      
      // Debug logging in development
      if (process.env.NODE_ENV === 'development') {
        console.error('[auth] Authentication error:', error);
      }
      
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
          />
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
          disabled={isLoading || (!showForgotPassword && (!email || !password))}
          variant="primary"
          size="lg"
          className="w-full"
          onClick={(e) => {
            // Ensure form submission on button click
            if (!isLoading && email && (showForgotPassword || password)) {
              const form = e.currentTarget.closest('form');
              if (form && !form.requestSubmit) {
                // Fallback for browsers that don't support requestSubmit
                form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
              } else if (form) {
                form.requestSubmit();
              }
            }
          }}
        >
          {showForgotPassword ? 'Send Reset Email' : isSignUp ? 'Sign Up' : 'Sign In'}
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