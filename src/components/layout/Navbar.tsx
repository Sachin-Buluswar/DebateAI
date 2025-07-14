'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import DarkModeToggle from '@/components/ui/DarkModeToggle';
import ProfileMenu from '@/components/auth/ProfileMenu';
import { cn } from '@/utils/cn';
import { useSidebar } from './Layout';

const navigation = [
  { name: 'dashboard', href: '/dashboard' },
  { name: 'history', href: '/history' },
  { name: 'search', href: '/search' },
  { name: 'feedback', href: '/speech-feedback' },
  { name: 'debate', href: '/debate' },
];

export default function Navbar() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const pathname = usePathname();
  
  // Get sidebar context
  const sidebarContext = useSidebar();

  const pathsWithoutSidebar = ['/auth', '/', '/auth-test'];
  const showSidebarToggle = !!pathname && !pathsWithoutSidebar.includes(pathname) && sidebarContext;

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <>
      <nav 
        className={cn(
          'fixed w-full z-40 top-0 left-0 transition-all duration-300',
          isScrolled
            ? 'bg-white/95 dark:bg-gray-950/95 backdrop-blur-sm'
            : 'bg-transparent',
          isScrolled && 'border-b border-gray-200 dark:border-gray-800'
        )}
      >
        <div className="max-w-7xl mx-auto px-8">
          <div className="flex justify-between h-20 items-center">
            {/* Logo - Minimalist text only */}
            <div className="flex items-center">
              {/* Sidebar Toggle - Minimal style */}
              {showSidebarToggle && sidebarContext && (
                <button
                  onClick={sidebarContext.toggleSidebar}
                  className="hidden lg:flex items-center justify-center p-2 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors mr-6"
                  title={sidebarContext.isCollapsed ? 'expand sidebar' : 'collapse sidebar'}
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    {sidebarContext.isCollapsed ? (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                    ) : (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                    )}
                  </svg>
                </button>
              )}
              
              <Link 
                href="/" 
                className="text-2xl font-light tracking-wide text-gray-900 dark:text-gray-100 hover:text-primary-500 transition-colors"
              >
                debateai
              </Link>
            </div>
            
            {/* Desktop Navigation - Text only, minimal */}
            <div className="hidden md:flex md:items-center md:space-x-8">
              {navigation.map((item) => {
                const isActive = pathname?.startsWith(item.href) || false;
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={cn(
                      'text-sm transition-colors duration-200',
                      isActive
                        ? 'text-primary-500'
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
                    )}
                  >
                    {item.name}
                  </Link>
                );
              })}
            </div>
            
            {/* Right side items - Minimal */}
            <div className="hidden md:flex md:items-center md:space-x-6">
              <DarkModeToggle />
              <ProfileMenu />
            </div>
            
            {/* Mobile menu button - Simple hamburger */}
            <div className="flex items-center md:hidden space-x-4">
              <DarkModeToggle />
              <button
                type="button"
                className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              >
                <span className="sr-only">menu</span>
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  {isMobileMenuOpen ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h16" />
                  )}
                </svg>
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile menu - Minimalist full screen */}
      <div
        className={cn(
          'fixed inset-0 z-50 bg-white dark:bg-gray-950 transform transition-transform duration-300 md:hidden',
          isMobileMenuOpen ? 'translate-x-0' : 'translate-x-full'
        )}
      >
        <div className="flex flex-col h-full">
          {/* Mobile menu header */}
          <div className="flex items-center justify-between px-8 h-20 border-b border-gray-200 dark:border-gray-800">
            <span className="text-2xl font-light">menu</span>
            <button
              type="button"
              className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Mobile menu items - Large text, centered */}
          <div className="flex-1 flex flex-col justify-center items-center space-y-8">
            {navigation.map((item) => {
              const isActive = pathname?.startsWith(item.href) || false;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    'text-3xl font-light transition-colors duration-200',
                    isActive
                      ? 'text-primary-500'
                      : 'text-gray-900 dark:text-gray-100 hover:text-primary-500'
                  )}
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  {item.name}
                </Link>
              );
            })}
          </div>

          {/* Mobile menu footer */}
          <div className="border-t border-gray-200 dark:border-gray-800 px-8 py-6">
            <ProfileMenu />
          </div>
        </div>
      </div>
    </>
  );
}