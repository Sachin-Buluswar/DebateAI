'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import ConfirmDialog from '@/components/ui/ConfirmDialog';

export default function ProfileMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const [userName, setUserName] = useState('');
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  
  useEffect(() => {
    // Fetch user info when component mounts
    const fetchUserInfo = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          // Use email as username or first part of email before @
          const email = session.user.email || '';
          const name = email.split('@')[0] || 'user';
          setUserName(name.toLowerCase());
        }
      } catch (error) {
        console.error('Error fetching user info:', error);
      }
    };
    
    fetchUserInfo();
    
    // Add click outside listener to close dropdown
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);
  
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

  const handleLogoutClick = () => {
    setIsOpen(false);
    setShowLogoutConfirm(true);
  };
  
  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
        id="user-menu-button"
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        {userName || 'account'}
      </button>
      
      {isOpen && (
        <div 
          className="absolute right-0 mt-4 w-48 bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 py-2"
          role="menu" 
          aria-orientation="vertical" 
          aria-labelledby="user-menu-button"
          tabIndex={-1}
        >
          <Link 
            href="/dashboard" 
            className="block px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
            role="menuitem"
            onClick={() => setIsOpen(false)}
          >
            dashboard
          </Link>
          
          <Link 
            href="/preferences" 
            className="block px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
            role="menuitem"
            onClick={() => setIsOpen(false)}
          >
            settings
          </Link>
          
          <div className="border-t border-gray-200 dark:border-gray-800 my-2"></div>
          
          <button
            className="block w-full text-left px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-primary-500 transition-colors"
            role="menuitem"
            onClick={handleLogoutClick}
            disabled={isLoggingOut}
          >
            {isLoggingOut ? 'signing out...' : 'sign out'}
          </button>
        </div>
      )}
      
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
    </div>
  );
}