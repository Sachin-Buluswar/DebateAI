'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import ConfirmDialog from '@/components/ui/ConfirmDialog';

export default function LogoutButton({ className = '' }) {
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const router = useRouter();

  const handleLogout = async () => {
    try {
      setIsLoggingOut(true);
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        console.error('Error signing out:', error);
        return;
      }
      
      // Redirect to home page after successful logout
      router.push('/');
      router.refresh();
    } catch (error) {
      console.error('Exception during logout:', error);
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