export default function SearchLoading() {
  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* heading */}
      <div className="h-8 w-48 bg-gray-200 dark:bg-gray-700 rounded-lg mb-8 animate-pulse" />

      {/* search bar */}
      <div className="h-12 w-full bg-gray-200 dark:bg-gray-700 rounded-lg mb-8 animate-pulse" />

      {/* results area */}
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-5 space-y-3"
          >
            <div className="h-5 w-3/4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
            <div className="h-4 w-full bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
            <div className="h-4 w-5/6 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );
}
