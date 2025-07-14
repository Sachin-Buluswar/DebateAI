'use client';

import { useToast } from '@/components/ui/Toast';

export function useAlert() {
  const { addToast } = useToast();

  const showError = (message: string) => {
    addToast({
      message,
      type: 'error',
      duration: 6000
    });
  };

  const showSuccess = (message: string) => {
    addToast({
      message,
      type: 'success',
      duration: 5000
    });
  };

  const showWarning = (message: string) => {
    addToast({
      message,
      type: 'warning',
      duration: 5000
    });
  };

  const showInfo = (message: string) => {
    addToast({
      message,
      type: 'info',
      duration: 5000
    });
  };

  return {
    error: showError,
    success: showSuccess,
    warning: showWarning,
    info: showInfo
  };
}