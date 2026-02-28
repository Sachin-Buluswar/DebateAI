export default function HistoryLoading() {
  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* heading */}
      <div className="h-8 w-32 bg-gray-200 dark:bg-gray-700 rounded-lg mb-8 animate-pulse" />

      {/* list items */}
      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-4"
          >
            <div className="h-10 w-10 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-2/3 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
              <div className="h-3 w-1/3 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
            </div>
            <div className="h-6 w-16 bg-gray-200 dark:bg-gray-700 rounded animate-pulse shrink-0" />
          </div>
        ))}
      </div>
    </div>
  );
}
