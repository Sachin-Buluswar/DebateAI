'use client';

import React from 'react';
import { useTheme } from '@/components/providers/ThemeProvider';

export default function DarkModeToggle() {
  const { isDarkMode, toggleDarkMode } = useTheme();

  return (
    <button
      onClick={toggleDarkMode}
      className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
      aria-label={isDarkMode ? 'light mode' : 'dark mode'}
    >
      {isDarkMode ? 'light' : 'dark'}
    </button>
  );
}