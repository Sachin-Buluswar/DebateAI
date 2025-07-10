'use client';

import { InputHTMLAttributes, TextareaHTMLAttributes, forwardRef, useState, useId } from 'react';
import { cn } from '@/utils/cn';

interface EnhancedInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label: string;
  error?: string;
  helperText?: string;
  size?: 'sm' | 'md' | 'lg';
  multiline?: false;
  rows?: never;
}

interface EnhancedTextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  error?: string;
  helperText?: string;
  size?: 'sm' | 'md' | 'lg';
  multiline: true;
  rows?: number;
}

type Props = EnhancedInputProps | EnhancedTextareaProps;

const EnhancedInput = forwardRef<HTMLInputElement | HTMLTextAreaElement, Props>(
  ({ label, error, helperText, size = 'md', className, multiline = false, rows = 4, ...props }, ref) => {
    const [isFocused, setIsFocused] = useState(false);
    const [hasValue, setHasValue] = useState(false);
    const inputId = useId();

    const handleFocus = () => setIsFocused(true);
    const handleBlur = (e: any) => {
      setIsFocused(false);
      setHasValue(!!e.target.value);
    };

    const handleChange = (e: any) => {
      setHasValue(!!e.target.value);
      if ('onChange' in props && props.onChange) {
        props.onChange(e);
      }
    };

    const sizes = {
      sm: {
        input: 'pt-5 pb-1 text-sm',
        label: 'text-xs',
        labelOffset: 'top-1.5',
        labelFloat: '-translate-y-2.5 scale-90'
      },
      md: {
        input: 'pt-6 pb-1.5 text-base',
        label: 'text-sm',
        labelOffset: 'top-2',
        labelFloat: '-translate-y-3 scale-90'
      },
      lg: {
        input: 'pt-7 pb-2 text-lg',
        label: 'text-base',
        labelOffset: 'top-2.5',
        labelFloat: '-translate-y-3.5 scale-90'
      }
    };

    const currentSize = sizes[size];
    const isFloating = isFocused || hasValue || !!props.value || !!props.defaultValue;

    const baseInputStyles = cn(
      'block w-full bg-transparent border-0 border-b transition-all duration-300 focus:outline-none peer',
      'placeholder-transparent',
      currentSize.input,
      error 
        ? 'border-red-500 text-red-900 dark:text-red-400 focus:border-red-600' 
        : 'border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white focus:border-gray-900 dark:focus:border-gray-100',
      className
    );

    const labelStyles = cn(
      'absolute left-0 transition-all duration-300 pointer-events-none origin-left',
      currentSize.label,
      currentSize.labelOffset,
      isFloating ? currentSize.labelFloat : '',
      error
        ? 'text-red-600 dark:text-red-400'
        : isFloating 
          ? 'text-gray-700 dark:text-gray-300' 
          : 'text-gray-500 dark:text-gray-400'
    );

    const Component = multiline ? 'textarea' : 'input';
    const componentProps = multiline ? { rows, ...props } : props;

    return (
      <div className="relative">
        <div className="relative">
          <Component
            ref={ref as any}
            id={inputId}
            className={baseInputStyles}
            onFocus={handleFocus}
            onBlur={handleBlur}
            onChange={handleChange}
            placeholder=" "
            {...componentProps}
          />
          <label
            htmlFor={inputId}
            className={labelStyles}
          >
            {label}
          </label>
          
          {/* Focus indicator line */}
          <div 
            className={cn(
              'absolute bottom-0 left-0 h-0.5 bg-gray-900 dark:bg-gray-100 transition-all duration-300',
              isFocused ? 'w-full' : 'w-0',
              error && 'bg-red-600'
            )}
          />
        </div>
        
        {/* Helper text or error message */}
        {(error || helperText) && (
          <p className={cn(
            'mt-1.5 text-xs',
            error ? 'text-red-600 dark:text-red-400' : 'text-gray-500 dark:text-gray-400'
          )}>
            {error || helperText}
          </p>
        )}
      </div>
    );
  }
);

EnhancedInput.displayName = 'EnhancedInput';

export default EnhancedInput;