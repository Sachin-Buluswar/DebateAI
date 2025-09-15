'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { useToast } from '@/lib/toast';

export default function LogoutButton({ className = '' }) {
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const router = useRouter();
  const toast = useToast();

  const handleLogout = async () => {
    try {
      setIsLoggingOut(true);
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        // PRODUCTION: Logging disabled
        if (process.env.NODE_ENV === 'development') {
          console.error('Error signing out:', error);
        }
        toast.error('Failed to sign out. Please try again.');
        setShowLogoutConfirm(false);
        return;
      }
      
      // Close dialog before redirect
      setShowLogoutConfirm(false);
      
      // Redirect to home page after successful logout
      router.push('/');
      router.refresh();
    } catch (error) {
      // PRODUCTION: Logging disabled
      if (process.env.NODE_ENV === 'development') {
        console.error('Exception during logout:', error);
      }
      toast.error('An unexpected error occurred. Please try again.');
      setShowLogoutConfirm(false);
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setShowLogoutConfirm(true)}
        disabled={isLoggingOut}
        className={`px-8 py-3 text-sm font-medium bg-red-500 hover:bg-red-600 text-white border border-red-500 hover:border-red-600 transition-all duration-200 lowercase tracking-wide ${className}`}
        style={{ borderRadius: 0 }}
      >
        {isLoggingOut ? 'signing out...' : 'sign out'}
      </button>
      
      <ConfirmDialog
        isOpen={showLogoutConfirm}
        onClose={() => setShowLogoutConfirm(false)}
        onConfirm={handleLogout}
        title="Sign Out"
        message="Are you sure you want to sign out of your account?"
        confirmText="Sign Out"
        cancelText="Cancel"
        confirmButtonClass="px-8 py-3 text-sm font-medium bg-red-500 hover:bg-red-600 text-white border border-red-500 hover:border-red-600 transition-all duration-200 lowercase tracking-wide"
      />
    </>
  );
} 