export default function LearnLoading() {
  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* heading */}
      <div className="h-8 w-48 bg-gray-200 dark:bg-gray-700 rounded-lg mb-6 animate-pulse" />

      {/* filter bar */}
      <div className="flex gap-3 mb-8 overflow-hidden">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-9 w-24 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse shrink-0"
          />
        ))}
      </div>

      {/* resource card grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-5 space-y-3"
          >
            <div className="h-5 w-3/4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
            <div className="h-4 w-full bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
            <div className="h-4 w-2/3 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
            <div className="flex gap-2 mt-2">
              <div className="h-6 w-16 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
              <div className="h-6 w-20 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
