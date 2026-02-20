export default function DashboardLoading() {
  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* heading */}
      <div className="h-8 w-40 bg-gray-200 dark:bg-gray-700 rounded-lg mb-8 animate-pulse" />

      {/* stat cards row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-24 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse"
          />
        ))}
      </div>

      {/* chart placeholders */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
        <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
      </div>
    </div>
  );
}
