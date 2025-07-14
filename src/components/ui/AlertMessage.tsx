'use client';

import { ReactNode } from 'react';
import { cn } from '@/utils/cn';

interface AlertMessageProps {
  type: 'error' | 'success' | 'warning' | 'info';
  message: string | ReactNode;
  className?: string;
}

const alertStyles = {
  error: {
    container: 'bg-red-50 dark:bg-red-900/20 border-l-red-500',
    icon: 'text-red-500',
    text: 'text-red-800 dark:text-red-200'
  },
  success: {
    container: 'bg-green-50 dark:bg-green-900/20 border-l-[#87A96B]',
    icon: 'text-[#87A96B]',
    text: 'text-green-800 dark:text-green-200'
  },
  warning: {
    container: 'bg-yellow-50 dark:bg-yellow-900/20 border-l-yellow-500',
    icon: 'text-yellow-500',
    text: 'text-yellow-800 dark:text-yellow-200'
  },
  info: {
    container: 'bg-blue-50 dark:bg-blue-900/20 border-l-blue-500',
    icon: 'text-blue-500',
    text: 'text-blue-800 dark:text-blue-200'
  }
};

const icons = {
  error: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} 
        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  ),
  success: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} 
        d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  warning: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} 
        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  ),
  info: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} 
        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
};

export default function AlertMessage({ type, message, className }: AlertMessageProps) {
  const styles = alertStyles[type];
  
  return (
    <div 
      className={cn(
        'p-4 border-l-2',
        styles.container,
        className
      )} 
      style={{ borderRadius: 0 }}
    >
      <div className="flex items-start gap-3">
        <span className={cn('flex-shrink-0 mt-0.5', styles.icon)}>
          {icons[type]}
        </span>
        <p className={cn('text-sm flex-1', styles.text)}>
          {message}
        </p>
      </div>
    </div>
  );
}