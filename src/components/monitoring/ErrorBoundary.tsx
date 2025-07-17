'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import * as Sentry from '@sentry/nextjs';
import { sentryClient } from '../../../sentry.client.config';
import { Button } from '../ui/Button';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  showDetails?: boolean;
  resetKeys?: Array<string | number>;
  resetOnPropsChange?: boolean;
  isolate?: boolean;
  level?: 'page' | 'section' | 'component';
  componentName?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorBoundaryKey: number;
}

export class ErrorBoundary extends Component<Props, State> {
  private resetTimeoutId: NodeJS.Timeout | null = null;
  private previousResetKeys: Array<string | number> = [];

  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorBoundaryKey: 0,
    };
    
    if (props.resetKeys) {
      this.previousResetKeys = props.resetKeys;
    }
  }

  static getDerivedStateFromProps(props: Props, state: State): Partial<State> | null {
    if (props.resetKeys && state.hasError && state.previousResetKeys) {
      if (props.resetKeys.some((key, idx) => key !== state.previousResetKeys[idx])) {
        return {
          hasError: false,
          error: null,
          errorInfo: null,
          errorBoundaryKey: state.errorBoundaryKey + 1,
        };
      }
    }
    return null;
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('Error caught by boundary:', error, errorInfo);
    }

    // Report to Sentry with context
    sentryClient.captureException(error, {
      contexts: {
        react: {
          componentStack: errorInfo.componentStack,
        },
        errorBoundary: {
          level: this.props.level || 'component',
          componentName: this.props.componentName || 'Unknown',
        },
      },
      tags: {
        component: this.props.componentName || 'Unknown',
        level: this.props.level || 'component',
      },
      level: this.props.level === 'page' ? 'error' : 'warning',
    });

    // Call custom error handler
    this.props.onError?.(error, errorInfo);

    // Set error state
    this.setState({
      hasError: true,
      error,
      errorInfo,
    });

    // Auto-retry for non-critical components
    if (this.props.level === 'component' && !this.props.isolate) {
      this.scheduleReset(5000); // Retry after 5 seconds
    }
  }

  componentDidUpdate(prevProps: Props) {
    if (this.props.resetOnPropsChange && this.state.hasError) {
      // Reset if props changed significantly
      const hasSignificantChange = Object.keys(this.props).some(
        key => key !== 'children' && prevProps[key as keyof Props] !== this.props[key as keyof Props]
      );
      
      if (hasSignificantChange) {
        this.resetErrorBoundary();
      }
    }
    
    // Update reset keys
    if (this.props.resetKeys) {
      this.previousResetKeys = this.props.resetKeys;
    }
  }

  componentWillUnmount() {
    if (this.resetTimeoutId) {
      clearTimeout(this.resetTimeoutId);
    }
  }

  scheduleReset = (delay: number) => {
    if (this.resetTimeoutId) {
      clearTimeout(this.resetTimeoutId);
    }
    
    this.resetTimeoutId = setTimeout(() => {
      this.resetErrorBoundary();
    }, delay);
  };

  resetErrorBoundary = () => {
    if (this.resetTimeoutId) {
      clearTimeout(this.resetTimeoutId);
      this.resetTimeoutId = null;
    }

    // Add breadcrumb for error recovery
    sentryClient.addBreadcrumb({
      category: 'error-boundary',
      message: 'Error boundary reset',
      level: 'info',
      data: {
        componentName: this.props.componentName,
        level: this.props.level,
      },
    });

    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorBoundaryKey: this.state.errorBoundaryKey + 1,
    });
  };

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return <>{this.props.fallback}</>;
      }

      // Default error UI based on level
      const { level = 'component', showDetails = false } = this.props;

      if (level === 'page') {
        return (
          <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center px-4">
            <div className="max-w-md w-full text-center">
              <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
                Something went wrong
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mb-8">
                We encountered an unexpected error. Please try refreshing the page.
              </p>
              <div className="space-y-4">
                <Button onClick={() => window.location.reload()} variant="primary">
                  Refresh Page
                </Button>
                <Button onClick={this.resetErrorBoundary} variant="secondary">
                  Try Again
                </Button>
              </div>
              {showDetails && this.state.error && (
                <details className="mt-8 text-left">
                  <summary className="cursor-pointer text-sm text-gray-500 dark:text-gray-400">
                    Error Details
                  </summary>
                  <pre className="mt-2 text-xs bg-gray-100 dark:bg-gray-800 p-4 rounded overflow-auto">
                    {this.state.error.toString()}
                    {this.state.errorInfo?.componentStack}
                  </pre>
                </details>
              )}
            </div>
          </div>
        );
      }

      if (level === 'section') {
        return (
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-6">
            <div className="flex items-start space-x-3">
              <svg className="w-6 h-6 text-yellow-600 dark:text-yellow-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div className="flex-1">
                <h3 className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                  This section encountered an error
                </h3>
                <p className="mt-1 text-sm text-yellow-700 dark:text-yellow-300">
                  Some features may not be available.
                </p>
                <Button
                  onClick={this.resetErrorBoundary}
                  variant="secondary"
                  size="small"
                  className="mt-3"
                >
                  Retry
                </Button>
              </div>
            </div>
          </div>
        );
      }

      // Component level error
      return (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded p-4 text-sm">
          <p className="text-red-800 dark:text-red-200">
            Failed to load this component.
          </p>
          <button
            onClick={this.resetErrorBoundary}
            className="mt-2 text-red-600 dark:text-red-400 underline hover:no-underline"
          >
            Try again
          </button>
        </div>
      );
    }

    // Render children with unique key to force remount on reset
    return (
      <React.Fragment key={this.state.errorBoundaryKey}>
        {this.props.children}
      </React.Fragment>
    );
  }
}

// HOC for wrapping components with error boundary
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<Props, 'children'>
) {
  const WrappedComponent = (props: P) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </ErrorBoundary>
  );

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`;

  return WrappedComponent;
}

// Hook for error handling in functional components
export function useErrorHandler() {
  return (error: Error, errorInfo?: { componentStack?: string }) => {
    if (process.env.NODE_ENV === 'development') {
      console.error('Error handled by useErrorHandler:', error);
    }

    sentryClient.captureException(error, {
      contexts: errorInfo ? {
        react: {
          componentStack: errorInfo.componentStack,
        },
      } : undefined,
    });
  };
}