'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { useSidebar } from './Layout';

interface NavItem {
  name: string;
  shortName: string;
  href: string;
}

const navigation: NavItem[] = [
  {
    name: 'dashboard',
    shortName: 'd',
    href: '/dashboard',
  },
  {
    name: 'history',
    shortName: 'h',
    href: '/history',
  },
  {
    name: 'search',
    shortName: 's',
    href: '/search',
  },
  {
    name: 'feedback',
    shortName: 'f',
    href: '/speech-feedback',
  },
  {
    name: 'debate',
    shortName: 'db',
    href: '/debate',
  },
  {
    name: 'preferences',
    shortName: 'p',
    href: '/preferences',
  },
  {
    name: 'help',
    shortName: '?',
    href: '/feedback',
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [userName, setUserName] = useState('user');
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const sidebarContext = useSidebar();
  const isCollapsed = sidebarContext?.isCollapsed || false;
  
  useEffect(() => {
    // Get user info when the sidebar mounts
    const getUserInfo = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user?.email) {
          const name = session.user.email.split('@')[0];
          setUserName(name.toLowerCase());
        }
      } catch (error) {
        console.error('Error getting user info:', error);
      }
    };
    
    getUserInfo();
  }, []);
  
  const handleLogout = async () => {
    try {
      setIsLoggingOut(true);
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        console.error('Error signing out:', error);
        return;
      }
      
      router.push('/');
      router.refresh();
    } catch (error) {
      console.error('Exception during logout:', error);
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Navigation */}
      <nav className="flex-1 px-4 py-8 space-y-2">
        {navigation.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`
                block py-2 text-sm transition-colors duration-200
                ${isCollapsed ? 'text-center' : 'px-4'}
                ${isActive 
                  ? 'text-primary-500' 
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
                }
              `}
              title={isCollapsed ? item.name : undefined}
            >
              {isCollapsed ? item.shortName : item.name}
            </Link>
          );
        })}
      </nav>

      {/* User section */}
      <div className="border-t border-gray-200 dark:border-gray-800 px-4 py-6">
        {!isCollapsed && (
          <div className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            {userName}
          </div>
        )}
        <button
          onClick={handleLogout}
          disabled={isLoggingOut}
          className={`
            text-sm text-gray-600 dark:text-gray-400 
            hover:text-primary-500 transition-colors duration-200
            ${isCollapsed ? 'w-full text-center' : ''}
          `}
          title={isCollapsed ? 'sign out' : undefined}
        >
          {isLoggingOut ? '...' : (isCollapsed ? 'x' : 'sign out')}
        </button>
      </div>
    </div>
  );
}