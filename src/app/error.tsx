'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error('Runtime error:', error);
  }, [error]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-900 p-4 text-center">
      <h1 className="text-red-600 dark:text-red-400 mb-4">Something went wrong</h1>
      <p className="text-gray-600 dark:text-gray-400 max-w-md mb-8">
        An error occurred while loading this page. Please try again later.
      </p>
      <div className="flex flex-col sm:flex-row gap-4">
        <button
          onClick={reset}
          className="btn btn-primary"
        >
          Try again
        </button>
        <Link 
          href="/" 
          className="btn btn-secondary"
        >
          Go Back Home
        </Link>
      </div>
    </div>
  );
} 