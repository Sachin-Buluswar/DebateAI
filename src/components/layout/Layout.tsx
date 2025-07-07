'use client';

import React, { createContext, useContext, useState } from 'react';
import Navbar from './Navbar';
import Sidebar from './Sidebar';
import { usePathname } from 'next/navigation';

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
};

export default function Layout({ children }: LayoutProps) {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);
  
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
      {/* Use ThemeProvider context for dark mode class on html/body */}
      <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
        <Navbar />
        <div className="flex pt-16"> {/* Add padding-top to account for fixed Navbar height */}
          {showSidebar && (
            // Add a wrapper div for fixed positioning and styling
            <div className={`hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0 lg:pt-16 lg:z-40 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 transition-all duration-300 ${
              isCollapsed ? 'lg:w-16' : 'lg:w-64'
            }`}>
              <Sidebar />
            </div>
          )}
          {/* Adjust main content margin based on sidebar presence and state */}
          <main className={`flex-1 transition-all duration-300 ease-in-out ${
            showSidebar 
              ? isCollapsed 
                ? 'lg:ml-16' 
                : 'lg:ml-64' 
              : ''
          } p-4 sm:p-6 lg:p-8`}>
            {/* Future: Add Breadcrumbs component here based on Pillar 1.5 */}
            {children}
          </main>
        </div>
      </div>
    </SidebarContext.Provider>
  );
} 