interface LoadingSpinnerProps {
  fullScreen?: boolean;
  size?: 'sm' | 'md' | 'lg';
  text?: string;
}

export function LoadingSpinner({ fullScreen = false, size = 'md', text }: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'w-6 h-6 border-2',
    md: 'w-8 h-8 border-4',
    lg: 'w-12 h-12 border-4'
  };

  const spinner = (
    <div className="flex flex-col items-center justify-center">
      <div
        className={`${sizeClasses[size]} border-[#87A96B] border-t-transparent rounded-full animate-spin`}
        style={{ borderWidth: size === 'sm' ? '2px' : '3px' }}
      />
      {text && (
        <p className="mt-4 text-gray-600 dark:text-gray-400 text-sm font-normal lowercase">{text}</p>
      )}
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-white dark:bg-gray-900 bg-opacity-90 dark:bg-opacity-90 z-50">
        {spinner}
      </div>
    );
  }

  return spinner;
} 