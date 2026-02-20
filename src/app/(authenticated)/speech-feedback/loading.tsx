export default function SpeechFeedbackLoading() {
  return (
    <div className="p-6 max-w-3xl mx-auto">
      {/* heading */}
      <div className="h-8 w-48 bg-gray-200 dark:bg-gray-700 rounded-lg mb-8 animate-pulse" />

      {/* form card */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-6 space-y-5">
        {/* label + input line */}
        <div className="space-y-2">
          <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          <div className="h-10 w-full bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
        </div>

        {/* label + textarea */}
        <div className="space-y-2">
          <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          <div className="h-32 w-full bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
        </div>

        {/* label + input line */}
        <div className="space-y-2">
          <div className="h-4 w-28 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          <div className="h-10 w-full bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
        </div>

        {/* submit button */}
        <div className="h-10 w-36 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
      </div>
    </div>
  );
}
