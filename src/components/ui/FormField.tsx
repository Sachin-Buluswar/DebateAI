'use client';

import React, { useState, useEffect, useId, ReactNode } from 'react';
import { cn } from '@/utils/cn';

interface FormFieldProps {
  label: string;
  name: string;
  type?: 'text' | 'email' | 'password' | 'tel' | 'url' | 'number' | 'textarea' | 'select';
  value: string | number;
  onChange: (value: string) => void;
  onBlur?: () => void;
  error?: string | null;
  required?: boolean;
  placeholder?: string;
  helpText?: string;
  disabled?: boolean;
  autoComplete?: string;
  className?: string;
  inputClassName?: string;
  rows?: number; // for textarea
  options?: { value: string; label: string }[]; // for select
  validateOnChange?: boolean;
  validateOnBlur?: boolean;
  showCharCount?: boolean;
  maxLength?: number;
  prefix?: ReactNode;
  suffix?: ReactNode;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean;
}

export const FormField: React.FC<FormFieldProps> = ({
  label,
  name,
  type = 'text',
  value,
  onChange,
  onBlur,
  error,
  required = false,
  placeholder,
  helpText,
  disabled = false,
  autoComplete,
  className,
  inputClassName,
  rows = 3,
  options = [],
  validateOnChange = false,
  validateOnBlur = true,
  showCharCount = false,
  maxLength,
  prefix,
  suffix,
  ...ariaProps
}) => {
  const [touched, setTouched] = useState(false);
  const [internalError, setInternalError] = useState<string | null>(null);
  const id = useId();
  const errorId = `${id}-error`;
  const helpId = `${id}-help`;
  
  // Determine which error to show
  const displayError = error || internalError;
  const showError = displayError && (touched || validateOnChange);
  
  useEffect(() => {
    if (error !== undefined) {
      setInternalError(null);
    }
  }, [error]);
  
  const handleBlur = () => {
    setTouched(true);
    if (validateOnBlur && onBlur) {
      onBlur();
    }
  };
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const newValue = e.target.value;
    onChange(newValue);
    
    if (validateOnChange && touched) {
      // Basic validation can be done here
      if (required && !newValue.trim()) {
        setInternalError(`${label} is required`);
      } else if (maxLength && newValue.length > maxLength) {
        setInternalError(`${label} must be no more than ${maxLength} characters`);
      } else {
        setInternalError(null);
      }
    }
  };
  
  const baseInputClasses = cn(
    'w-full px-3 py-2 border rounded-md transition-all duration-200',
    'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent',
    'disabled:bg-gray-100 disabled:cursor-not-allowed dark:disabled:bg-gray-800',
    showError ? 'border-red-500 bg-red-50 dark:bg-red-950/20' : 'border-gray-300 dark:border-gray-600',
    'dark:bg-gray-800 dark:text-gray-100',
    inputClassName
  );
  
  const renderInput = () => {
    const commonProps = {
      id,
      name,
      value,
      onChange: handleChange,
      onBlur: handleBlur,
      disabled,
      autoComplete,
      placeholder,
      'aria-required': required,
      'aria-invalid': showError || ariaProps['aria-invalid'],
      'aria-describedby': cn(
        showError && errorId,
        helpText && helpId,
        ariaProps['aria-describedby']
      ).trim() || undefined,
    };
    
    if (type === 'textarea') {
      return (
        <textarea
          {...commonProps}
          rows={rows}
          maxLength={maxLength}
          className={baseInputClasses}
        />
      );
    }
    
    if (type === 'select') {
      return (
        <select
          {...commonProps}
          className={baseInputClasses}
        >
          <option value="">Select {label.toLowerCase()}</option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      );
    }
    
    return (
      <div className="relative">
        {prefix && (
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-500">
            {prefix}
          </div>
        )}
        <input
          {...commonProps}
          type={type}
          maxLength={maxLength}
          className={cn(
            baseInputClasses,
            prefix && 'pl-10',
            suffix && 'pr-10'
          )}
        />
        {suffix && (
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-gray-500">
            {suffix}
          </div>
        )}
      </div>
    );
  };
  
  return (
    <div className={cn('space-y-1', className)}>
      {/* Label */}
      <label
        htmlFor={id}
        className="block text-sm font-medium text-gray-700 dark:text-gray-200"
      >
        {label}
        {required && <span className="text-red-500 ml-1" aria-label="required">*</span>}
      </label>
      
      {/* Input field */}
      {renderInput()}
      
      {/* Character count */}
      {showCharCount && maxLength && (
        <div className="text-xs text-gray-500 dark:text-gray-400 text-right">
          {value ? String(value).length : 0} / {maxLength}
        </div>
      )}
      
      {/* Help text */}
      {helpText && !showError && (
        <p id={helpId} className="text-sm text-gray-500 dark:text-gray-400">
          {helpText}
        </p>
      )}
      
      {/* Error message */}
      {showError && (
        <p
          id={errorId}
          className="text-sm text-red-600 dark:text-red-400 flex items-center gap-1"
          role="alert"
        >
          <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          {displayError}
        </p>
      )}
    </div>
  );
};

// Export a specialized component for common field types
export const EmailField: React.FC<Omit<FormFieldProps, 'type'>> = (props) => (
  <FormField {...props} type="email" autoComplete="email" />
);

export const PasswordField: React.FC<Omit<FormFieldProps, 'type'>> = (props) => (
  <FormField {...props} type="password" autoComplete="current-password" />
);

export const TextAreaField: React.FC<Omit<FormFieldProps, 'type'>> = (props) => (
  <FormField {...props} type="textarea" />
);

export const SelectField: React.FC<Omit<FormFieldProps, 'type'>> = (props) => (
  <FormField {...props} type="select" />
);