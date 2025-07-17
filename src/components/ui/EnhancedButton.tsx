'use client';

import { ButtonHTMLAttributes, ReactNode, forwardRef } from 'react';
import { cn } from '@/utils/cn';

interface EnhancedButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'outline' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  loadingText?: string;
  icon?: ReactNode;
  iconPosition?: 'left' | 'right';
  fullWidth?: boolean;
  className?: string;
  children: ReactNode;
}

const EnhancedButton = forwardRef<HTMLButtonElement, EnhancedButtonProps>(
  ({
    variant = 'primary',
    size = 'md',
    loading = false,
    loadingText = 'loading...',
    icon,
    iconPosition = 'left',
    fullWidth = false,
    className,
    children,
    disabled,
    ...props
  }, ref) => {
    const baseStyles = 'relative inline-flex items-center justify-center font-medium transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:cursor-not-allowed overflow-hidden';
    
    const variants = {
      primary: 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-200 focus:ring-gray-500 disabled:bg-gray-400 dark:disabled:bg-gray-600',
      secondary: 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 hover:bg-gray-200 dark:hover:bg-gray-700 focus:ring-gray-400 disabled:bg-gray-50 dark:disabled:bg-gray-900',
      ghost: 'bg-transparent hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 focus:ring-gray-400 disabled:text-gray-400',
      outline: 'border border-gray-300 dark:border-gray-700 bg-transparent hover:bg-gray-50 dark:hover:bg-gray-900 text-gray-700 dark:text-gray-300 focus:ring-gray-400 disabled:text-gray-400',
      danger: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500 disabled:bg-red-300'
    };
    
    const sizes = {
      sm: 'px-3 py-1.5 text-sm gap-1.5',
      md: 'px-4 py-2 text-base gap-2',
      lg: 'px-6 py-3 text-lg gap-2.5'
    };
    
    const ringOffsets = {
      sm: 'focus:ring-offset-1',
      md: 'focus:ring-offset-2',
      lg: 'focus:ring-offset-2'
    };

    // Loading spinner component
    const LoadingSpinner = () => (
      <svg
        className={cn(
          'animate-spin',
          size === 'sm' ? 'h-3 w-3' : size === 'md' ? 'h-4 w-4' : 'h-5 w-5'
        )}
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        />
      </svg>
    );

    return (
      <button
        ref={ref}
        className={cn(
          baseStyles,
          variants[variant],
          sizes[size],
          ringOffsets[size],
          fullWidth && 'w-full',
          loading && 'cursor-wait',
          className
        )}
        disabled={disabled || loading}
        {...props}
      >
        {/* Hover effect overlay */}
        <span 
          className={cn(
            'absolute inset-0 transition-opacity duration-300',
            variant === 'primary' ? 'bg-white/10' : 'bg-gray-900/5',
            'opacity-0 hover:opacity-100'
          )} 
        />
        
        {/* Button content */}
        <span className="relative flex items-center justify-center gap-2">
          {loading ? (
            <>
              <LoadingSpinner />
              <span className="lowercase">{loadingText}</span>
            </>
          ) : (
            <>
              {icon && iconPosition === 'left' && (
                <span className={cn(
                  'transition-transform duration-300 group-hover:scale-110',
                  size === 'sm' ? 'w-4 h-4' : size === 'md' ? 'w-5 h-5' : 'w-6 h-6'
                )}>
                  {icon}
                </span>
              )}
              <span className="lowercase">{children}</span>
              {icon && iconPosition === 'right' && (
                <span className={cn(
                  'transition-transform duration-300 group-hover:scale-110',
                  size === 'sm' ? 'w-4 h-4' : size === 'md' ? 'w-5 h-5' : 'w-6 h-6'
                )}>
                  {icon}
                </span>
              )}
            </>
          )}
        </span>

        {/* Press effect */}
        <span className="absolute inset-0 transition-transform duration-100 active:scale-95" />
      </button>
    );
  }
);

EnhancedButton.displayName = 'EnhancedButton';

export default EnhancedButton;