'use client';

import { useState, useEffect, useRef } from 'react';
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

export default function EnhancedNavbar() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [scrollState, setScrollState] = useState<'top' | 'scrolling' | 'scrolled'>('top');
  const [isCompact, setIsCompact] = useState(false);
  const pathname = usePathname();
  const lastScrollY = useRef(0);
  const scrollTimeout = useRef<NodeJS.Timeout>();
  
  // Get sidebar context
  const sidebarContext = useSidebar();

  const pathsWithoutSidebar = ['/auth', '/', '/auth-test'];
  const showSidebarToggle = !!pathname && !pathsWithoutSidebar.includes(pathname) && sidebarContext;

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      
      // Clear existing timeout
      if (scrollTimeout.current) clearTimeout(scrollTimeout.current);
      
      if (currentScrollY === 0) {
        setScrollState('top');
        setIsCompact(false);
      } else if (currentScrollY > lastScrollY.current && currentScrollY > 150) {
        // Scrolling down and past threshold
        setScrollState('scrolling');
        setIsCompact(true);
      } else if (currentScrollY < lastScrollY.current - 5) {
        // Scrolling up
        setScrollState('scrolled');
        setIsCompact(false);
      }
      
      // Set scrolled state after scroll stops
      scrollTimeout.current = setTimeout(() => {
        if (currentScrollY > 0) {
          setScrollState('scrolled');
        }
      }, 150);
      
      lastScrollY.current = currentScrollY;
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (scrollTimeout.current) clearTimeout(scrollTimeout.current);
    };
  }, []);

  return (
    <>
      <nav 
        className={cn(
          'fixed w-full z-40 top-0 left-0 transition-all duration-300 ease-out',
          scrollState === 'top' 
            ? 'bg-transparent' 
            : 'bg-white/95 dark:bg-gray-950/95 backdrop-blur-sm',
          scrollState !== 'top' && 'border-b border-gray-200 dark:border-gray-800',
          isCompact ? 'transform -translate-y-1/2' : 'transform translate-y-0'
        )}
      >
        <div className="max-w-7xl mx-auto px-8">
          <div className={cn(
            'flex justify-between items-center transition-all duration-300 ease-out',
            isCompact ? 'h-14' : 'h-20'
          )}>
            {/* Logo and Sidebar Toggle */}
            <div className="flex items-center">
              {/* Sidebar Toggle - Enhanced animation */}
              {showSidebarToggle && sidebarContext && (
                <button
                  onClick={sidebarContext.toggleSidebar}
                  className={cn(
                    'hidden lg:flex items-center justify-center p-2 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-all duration-200',
                    isCompact ? 'mr-4 scale-90' : 'mr-6'
                  )}
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
                className={cn(
                  'font-light tracking-wide text-gray-900 dark:text-gray-100 hover:text-primary-500 transition-all duration-200',
                  isCompact ? 'text-xl' : 'text-2xl'
                )}
              >
                debateai
              </Link>
            </div>
            
            {/* Desktop Navigation - Enhanced with animations */}
            <div className="hidden md:flex md:items-center md:space-x-8">
              <div className={cn(
                'flex items-center transition-all duration-200',
                isCompact ? 'space-x-6' : 'space-x-8'
              )}>
                {navigation.map((item) => {
                  const isActive = pathname?.startsWith(item.href) || false;
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      className={cn(
                        'relative text-sm font-medium transition-all duration-200',
                        isActive
                          ? 'text-primary-600 dark:text-primary-400'
                          : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100',
                        isCompact && 'text-xs'
                      )}
                    >
                      <span className="relative">
                        {item.name}
                        {/* Active indicator - animated underline */}
                        <span
                          className={cn(
                            'absolute -bottom-1 left-0 h-0.5 bg-primary-500 transition-all duration-200',
                            isActive ? 'w-full' : 'w-0'
                          )}
                        />
                      </span>
                    </Link>
                  );
                })}
              </div>
              
              {/* Right side items */}
              <div className="flex items-center space-x-4 ml-8">
                <div className={cn(
                  'transition-all duration-200',
                  isCompact && 'scale-90'
                )}>
                  <DarkModeToggle />
                </div>
                <div className={cn(
                  'transition-all duration-200',
                  isCompact && 'scale-95'
                )}>
                  <ProfileMenu />
                </div>
              </div>
            </div>

            {/* Mobile menu button - Enhanced */}
            <div className="md:hidden flex items-center space-x-4">
              <DarkModeToggle />
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="p-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
                aria-label="toggle menu"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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

      {/* Mobile menu - Enhanced with smooth animations */}
      <div
        className={cn(
          'fixed inset-0 z-50 bg-white dark:bg-gray-950 md:hidden transition-all duration-200',
          isMobileMenuOpen 
            ? 'opacity-100 pointer-events-auto' 
            : 'opacity-0 pointer-events-none'
        )}
      >
        <div className="flex justify-end p-6">
          <button
            onClick={() => setIsMobileMenuOpen(false)}
            className="p-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
          >
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <nav className="flex flex-col items-center justify-center h-full -mt-20 space-y-8">
          {navigation.map((item, index) => {
            const isActive = pathname?.startsWith(item.href) || false;
            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={() => setIsMobileMenuOpen(false)}
                className={cn(
                  'text-3xl font-light transition-all duration-200',
                  isActive
                    ? 'text-primary-600 dark:text-primary-400'
                    : 'text-gray-900 dark:text-gray-100',
                  isMobileMenuOpen && 'animate-fade-in-up'
                )}
                style={{
                  animationDelay: `${index * 100}ms`
                }}
              >
                {item.name}
              </Link>
            );
          })}
          <div
            className={cn(
              'pt-8',
              isMobileMenuOpen && 'animate-fade-in-up'
            )}
            style={{
              animationDelay: `${navigation.length * 100}ms`
            }}
          >
            <ProfileMenu />
          </div>
        </nav>
      </div>
    </>
  );
}