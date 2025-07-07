'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

export default function ProfileMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const [userName, setUserName] = useState('');
  const [isLoggingOut, setIsLoggingOut] = useState(false);
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
          const name = email.split('@')[0] || 'User';
          setUserName(name);
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
  
  return (
    <div className="relative ml-3" ref={dropdownRef}>
      <div>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex text-sm bg-blue-100 dark:bg-blue-900 rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          id="user-menu-button"
          aria-expanded={isOpen}
          aria-haspopup="true"
        >
          <span className="sr-only">Open user menu</span>
          <div className="h-8 w-8 rounded-full flex items-center justify-center text-blue-600 dark:text-blue-300">
            <span className="font-medium text-sm">{userName.charAt(0).toUpperCase()}</span>
          </div>
        </button>
      </div>
      
      {isOpen && (
        <div 
          className="origin-top-right absolute right-0 mt-2 w-48 rounded-md shadow-lg py-1 bg-white dark:bg-gray-800 ring-1 ring-black ring-opacity-5 focus:outline-none z-10"
          role="menu" 
          aria-orientation="vertical" 
          aria-labelledby="user-menu-button"
          tabIndex={-1}
        >
          <div className="px-4 py-2 text-xs text-gray-500 dark:text-gray-400">
            Signed in as<br />
            <span className="font-medium text-gray-900 dark:text-white">{userName}</span>
          </div>
          
          <div className="border-t border-gray-100 dark:border-gray-700"></div>
          
          <Link 
            href="/dashboard" 
            className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
            role="menuitem"
            onClick={() => setIsOpen(false)}
          >
            Dashboard
          </Link>
          
          <Link 
            href="/preferences" 
            className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
            role="menuitem"
            onClick={() => setIsOpen(false)}
          >
            Settings
          </Link>
          
          <div className="border-t border-gray-100 dark:border-gray-700"></div>
          
          <button
            className="block w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700"
            role="menuitem"
            onClick={handleLogout}
            disabled={isLoggingOut}
          >
            {isLoggingOut ? 'Signing out...' : 'Sign out'}
          </button>
        </div>
      )}
    </div>
  );
} 