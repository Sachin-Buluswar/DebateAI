'use client';

import { useToast as useToastBase } from '@/components/ui/Toast';

// Type for the global addToast function
interface AddToastFunction {
  (toast: {
    message: string;
    type: 'success' | 'error' | 'warning' | 'info';
    duration?: number;
    action?: { label: string; onClick: () => void };
  }): void;
}

declare global {
  interface Window {
    __addToast?: AddToastFunction;
  }
}

// Convenience wrapper for toast notifications
export const toast = {
  success: (message: string, options?: { duration?: number; action?: { label: string; onClick: () => void } }) => {
    // This will be called within components that use the toast
    const addToast = window.__addToast;
    if (addToast) {
      addToast({
        message,
        type: 'success',
        duration: options?.duration || 5000,
        action: options?.action
      });
    }
  },
  
  error: (message: string, options?: { duration?: number; action?: { label: string; onClick: () => void } }) => {
    const addToast = window.__addToast;
    if (addToast) {
      addToast({
        message,
        type: 'error',
        duration: options?.duration || 7000, // Errors show longer
        action: options?.action
      });
    }
  },
  
  warning: (message: string, options?: { duration?: number; action?: { label: string; onClick: () => void } }) => {
    const addToast = window.__addToast;
    if (addToast) {
      addToast({
        message,
        type: 'warning',
        duration: options?.duration || 6000,
        action: options?.action
      });
    }
  },
  
  info: (message: string, options?: { duration?: number; action?: { label: string; onClick: () => void } }) => {
    const addToast = window.__addToast;
    if (addToast) {
      addToast({
        message,
        type: 'info',
        duration: options?.duration || 5000,
        action: options?.action
      });
    }
  }
};

// Hook for components that need direct access to toast functionality
export const useToast = () => {
  const { addToast } = useToastBase();
  
  // Store addToast globally for the convenience functions
  if (typeof window !== 'undefined') {
    window.__addToast = addToast;
  }
  
  return {
    success: (message: string, options?: { duration?: number; action?: { label: string; onClick: () => void } }) => {
      addToast({
        message,
        type: 'success',
        duration: options?.duration || 5000,
        action: options?.action
      });
    },
    
    error: (message: string, options?: { duration?: number; action?: { label: string; onClick: () => void } }) => {
      addToast({
        message,
        type: 'error',
        duration: options?.duration || 7000,
        action: options?.action
      });
    },
    
    warning: (message: string, options?: { duration?: number; action?: { label: string; onClick: () => void } }) => {
      addToast({
        message,
        type: 'warning',
        duration: options?.duration || 6000,
        action: options?.action
      });
    },
    
    info: (message: string, options?: { duration?: number; action?: { label: string; onClick: () => void } }) => {
      addToast({
        message,
        type: 'info',
        duration: options?.duration || 5000,
        action: options?.action
      });
    }
  };
};