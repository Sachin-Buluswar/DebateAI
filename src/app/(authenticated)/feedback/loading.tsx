export default function FeedbackLoading() {
  return (
    <div className="p-6 max-w-2xl mx-auto">
      {/* heading */}
      <div className="h-8 w-48 bg-gray-200 dark:bg-gray-700 rounded-lg mb-6 animate-pulse" />

      {/* description */}
      <div className="h-4 w-72 bg-gray-200 dark:bg-gray-700 rounded mb-8 animate-pulse" />

      {/* form skeleton */}
      <div className="space-y-6">
        <div className="h-12 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
        <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
        <div className="h-10 w-32 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
      </div>
    </div>
  );
}
