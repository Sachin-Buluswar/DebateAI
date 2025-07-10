'use client';

import { useRouter } from 'next/navigation';
import { cn } from '@/utils/cn';

interface BackButtonProps {
  href?: string;
  label?: string;
  className?: string;
}

export default function BackButton({ 
  href = '/', 
  label = '← back', 
  className 
}: BackButtonProps) {
  const router = useRouter();

  const handleBack = () => {
    if (window.history.length > 2) {
      router.back();
    } else {
      router.push(href);
    }
  };

  return (
    <button
      onClick={handleBack}
      className={cn(
        'text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100',
        'transition-colors duration-200',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-4',
        className
      )}
    >
      {label}
    </button>
  );
}