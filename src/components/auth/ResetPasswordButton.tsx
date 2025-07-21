'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import EnhancedButton from '@/components/ui/EnhancedButton';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';

interface ResetPasswordButtonProps {
  userEmail?: string | null;
}

export default function ResetPasswordButton({ userEmail }: ResetPasswordButtonProps) {
  const { addToast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleResetPassword = async () => {
    if (!userEmail) {
      addToast({ message: 'No email address found', type: 'error' });
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(userEmail, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      });
      
      if (error) throw error;
      
      addToast({ 
        message: 'Password reset email sent! Please check your inbox.', 
        type: 'success' 
      });
      setShowConfirm(false);
    } catch (error) {
      console.error('Error sending reset email:', error);
      addToast({ 
        message: 'Failed to send reset email. Please try again.', 
        type: 'error' 
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <EnhancedButton
        onClick={() => setShowConfirm(true)}
        variant="outline"
        size="sm"
        className="lowercase"
      >
        reset password
      </EnhancedButton>
      
      <ConfirmDialog
        isOpen={showConfirm}
        onClose={() => setShowConfirm(false)}
        onConfirm={handleResetPassword}
        title="Reset Password"
        message={`Send a password reset link to ${userEmail}?`}
        confirmText={isLoading ? 'Sending...' : 'Send Reset Link'}
        cancelText="Cancel"
        confirmButtonClass="px-8 py-3 text-sm font-medium bg-primary-500 hover:bg-primary-600 text-white border border-primary-500 hover:border-primary-600 transition-all duration-200 lowercase tracking-wide"
      />
    </>
  );
}