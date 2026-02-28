export default function PreferencesLoading() {
  return (
    <div className="p-6 max-w-3xl mx-auto">
      {/* heading */}
      <div className="h-8 w-40 bg-gray-200 dark:bg-gray-700 rounded-lg mb-8 animate-pulse" />

      {/* form sections */}
      <div className="space-y-8">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-6 space-y-4"
          >
            {/* section heading */}
            <div className="h-5 w-36 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />

            {/* field rows */}
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                <div className="h-10 w-full bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
              </div>
              <div className="space-y-2">
                <div className="h-4 w-28 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                <div className="h-10 w-full bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
              </div>
            </div>
          </div>
        ))}

        {/* save button */}
        <div className="h-10 w-28 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
      </div>
    </div>
  );
}
