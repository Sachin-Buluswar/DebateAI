import React, { HTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../utils/cn';

const badgeVariants = cva(
  'inline-flex items-center font-medium transition-all duration-200 lowercase tracking-wide',
  {
    variants: {
      variant: {
        primary: 'bg-[#87A96B]/10 text-[#87A96B] dark:bg-[#87A96B]/20 dark:text-[#87A96B] border border-[#87A96B]/20',
        secondary: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200 border border-gray-200 dark:border-gray-700',
        success: 'bg-green-50 text-green-800 dark:bg-green-900/20 dark:text-green-200 border border-green-200 dark:border-green-800',
        warning: 'bg-yellow-50 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-200 border border-yellow-200 dark:border-yellow-800',
        error: 'bg-red-50 text-red-800 dark:bg-red-900/20 dark:text-red-200 border border-red-200 dark:border-red-800',
        info: 'bg-gray-50 text-gray-800 dark:bg-gray-800 dark:text-gray-200 border border-gray-200 dark:border-gray-700',
        outline: 'border border-current',
      },
      size: {
        xs: 'px-2 py-0.5 text-xs',
        sm: 'px-3 py-1 text-xs',
        md: 'px-4 py-1.5 text-sm',
        lg: 'px-5 py-2 text-base',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'sm',
    },
  }
);

interface BadgeProps
  extends HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  children: React.ReactNode;
  dot?: boolean;
}

export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant, size, children, dot, ...props }, ref) => {
    return (
      <span
        ref={ref}
        className={cn(badgeVariants({ variant, size }), className)}
        style={{ borderRadius: 0 }}
        {...props}
      >
        {dot && (
          <span
            className={cn(
              'w-1.5 h-1.5 mr-1.5',
              variant === 'primary' && 'bg-[#87A96B]',
              variant === 'secondary' && 'bg-gray-500',
              variant === 'success' && 'bg-green-500',
              variant === 'warning' && 'bg-yellow-500',
              variant === 'error' && 'bg-red-500',
              variant === 'info' && 'bg-gray-500',
              variant === 'outline' && 'bg-current'
            )}
            style={{ borderRadius: 0 }}
          />
        )}
        {children}
      </span>
    );
  }
);

Badge.displayName = 'Badge';

export default Badge; 