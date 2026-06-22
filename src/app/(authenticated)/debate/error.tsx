'use client';

import Link from 'next/link';

export default function DebateError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="space-y-2">
          <h2 className="text-2xl font-light text-gray-900 dark:text-gray-100">
            something went wrong
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            we encountered an error loading the debate simulator. please try again or start a new
            session.
          </p>
          {error.digest && (
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
              Error ID: {error.digest}
            </p>
          )}
        </div>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={reset}
            className="inline-flex items-center justify-center px-4 py-2.5 text-sm font-medium rounded-lg bg-primary-600 text-white hover:bg-primary-700 shadow-md hover:shadow-lg transition-all duration-200 dark:bg-primary-500 dark:hover:bg-primary-600"
          >
            try again
          </button>
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center px-4 py-2.5 text-sm font-medium rounded-lg bg-transparent text-gray-700 hover:bg-gray-100 transition-all duration-200 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            go to dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
