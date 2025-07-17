'use client';

import { cn } from '@/utils/cn';

interface ErrorMessageProps {
  error: string | null;
  className?: string;
  inline?: boolean;
}

export default function ErrorMessage({ error, className, inline = false }: ErrorMessageProps) {
  if (!error) return null;

  if (inline) {
    return (
      <span className={cn(
        'text-sm text-red-600 dark:text-red-400',
        className
      )}>
        {error}
      </span>
    );
  }

  return (
    <div 
      className={cn(
        'p-4 border-l-2 border-l-red-500 bg-red-50 dark:bg-red-900/20',
        'text-sm text-red-800 dark:text-red-200',
        className
      )}
      style={{ borderRadius: 0 }}
    >
      <div className="flex items-start gap-3">
        <svg className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} 
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <p className="flex-1">{error}</p>
      </div>
    </div>
  );
}