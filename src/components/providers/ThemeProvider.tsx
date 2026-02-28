'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/lib/supabaseClient';

type ThemeContextType = {
  isDarkMode: boolean;
  toggleDarkMode: () => void;
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

interface ThemeProviderProps {
  children: ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  // Set light mode as default
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    // Always default to light mode unless user has a saved preference
    const fetchUserPreference = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();

        if (user) {
          // User is logged in, try to get their preference
          const { data } = await supabase
            .from('user_preferences')
            .select('preferences')
            .eq('user_id', user.id)
            .single();
          
          if (data && data.preferences && typeof data.preferences.darkMode === 'boolean') {
            setIsDarkMode(data.preferences.darkMode);
          } else {
            setIsDarkMode(false); // Default to light mode
          }
        } else {
          // No logged in user, check local storage or use light mode
          const storedTheme = localStorage.getItem('theme');
          if (storedTheme) {
            setIsDarkMode(storedTheme === 'dark');
          } else {
            setIsDarkMode(false); // Default to light mode
          }
        }
      } catch (_error) {
        // Default to light mode
        setIsDarkMode(false);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchUserPreference();
  }, []);
  
  // Update HTML class when dark mode changes
  useEffect(() => {
    if (!isLoading) {
      if (isDarkMode) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
      
      // Store in localStorage for non-logged-in users
      localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
    }
  }, [isDarkMode, isLoading]);
  
  const toggleDarkMode = async () => {
    const newValue = !isDarkMode;
    setIsDarkMode(newValue);
    
    try {
      // Try to update user preference if logged in
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        await supabase
          .from('user_preferences')
          .upsert({
            user_id: user.id,
            preferences: { darkMode: newValue },
            updated_at: new Date().toISOString(),
          }, { onConflict: 'user_id' });
      }
    } catch (_error) {
    }
  };
  
  return (
    <ThemeContext.Provider value={{ isDarkMode, toggleDarkMode }}>
      {children}
    </ThemeContext.Provider>
  );
} 