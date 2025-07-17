'use client';

import { cn } from '@/utils/cn';

interface SuccessMessageProps {
  message: string | null;
  className?: string;
  inline?: boolean;
}

export default function SuccessMessage({ message, className, inline = false }: SuccessMessageProps) {
  if (!message) return null;

  if (inline) {
    return (
      <span className={cn(
        'text-sm text-[#87A96B] dark:text-[#87A96B]',
        className
      )}>
        {message}
      </span>
    );
  }

  return (
    <div 
      className={cn(
        'p-4 border-l-2 border-l-[#87A96B] bg-green-50 dark:bg-green-900/20',
        'text-sm text-green-800 dark:text-green-200',
        className
      )}
      style={{ borderRadius: 0 }}
    >
      <div className="flex items-start gap-3">
        <svg className="w-5 h-5 text-[#87A96B] flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} 
            d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p className="flex-1">{message}</p>
      </div>
    </div>
  );
}