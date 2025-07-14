'use client';

import React, { createContext, useContext, useState } from 'react';
import Navbar from './Navbar';
import EnhancedNavbar from './EnhancedNavbar';
import Sidebar from './Sidebar';
import PageTransition from '@/components/ui/PageTransition';
import { usePathname } from 'next/navigation';
import { usePreferences } from '@/components/providers/PreferencesProvider';

// Define paths where sidebar should be hidden
const pathsWithoutSidebar = ['/auth', '/', '/auth-test']; // Add landing page, auth pages etc.

// Create sidebar context
interface SidebarContextType {
  isCollapsed: boolean;
  toggleSidebar: () => void;
}

const SidebarContext = createContext<SidebarContextType | undefined>(undefined);

export const useSidebar = () => {
  const context = useContext(SidebarContext);
  // Return null instead of throwing error to allow usage outside provider
  return context || null;
};

type LayoutProps = {
  children: React.ReactNode;
  useEnhancedNavbar?: boolean;
};

export default function Layout({ children, useEnhancedNavbar }: LayoutProps) {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { preferences, loading } = usePreferences();
  
  // Use enhanced navbar from preferences if not explicitly overridden
  const shouldUseEnhancedNavbar = useEnhancedNavbar !== undefined ? useEnhancedNavbar : preferences.enhancedNavbar;
  
  // Determine if sidebar should be shown based on current path
  const showSidebar = !!pathname && !pathsWithoutSidebar.includes(pathname);

  const toggleSidebar = () => {
    setIsCollapsed(!isCollapsed);
  };

  const sidebarContextValue = {
    isCollapsed,
    toggleSidebar,
  };

  return (
    <SidebarContext.Provider value={sidebarContextValue}>
      {/* Minimalist background */}
      <div className="min-h-screen bg-white dark:bg-gray-950">
        {shouldUseEnhancedNavbar ? <EnhancedNavbar /> : <Navbar />}
        <div className="flex pt-20"> {/* Add padding-top to account for fixed Navbar height */}
          {showSidebar && (
            // Minimalist sidebar styling
            <div className={`hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0 lg:pt-20 lg:z-30 bg-white dark:bg-gray-950 border-r border-gray-200 dark:border-gray-800 transition-all duration-300 ${
              isCollapsed ? 'lg:w-20' : 'lg:w-64'
            }`}>
              <Sidebar />
            </div>
          )}
          {/* Adjust main content margin based on sidebar presence and state */}
          <main className={`flex-1 transition-all duration-300 ease-in-out ${
            showSidebar 
              ? isCollapsed 
                ? 'lg:ml-20' 
                : 'lg:ml-64' 
              : ''
          } px-8 py-12 lg:px-16 lg:py-16`}>
            <PageTransition>
              {children}
            </PageTransition>
          </main>
        </div>
      </div>
    </SidebarContext.Provider>
  );
} 