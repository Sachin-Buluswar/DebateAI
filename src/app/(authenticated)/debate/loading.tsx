export default function DebateLoading() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="h-8 w-48 bg-gray-200 dark:bg-gray-700 rounded-lg mb-2 animate-pulse" />
      <div className="h-4 w-72 bg-gray-200 dark:bg-gray-700 rounded mb-8 animate-pulse" />

      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6 space-y-4">
        <div className="space-y-2">
          <div className="h-4 w-20 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          <div className="h-10 w-full bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
        </div>
        <div className="h-12 w-full bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
      </div>
    </div>
  );
}
