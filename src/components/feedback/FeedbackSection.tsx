'use client';

import { useState } from 'react';
import ReactMarkdown from 'react-markdown';

interface FeedbackSectionProps {
  title: string;
  content: string;
  initialCollapsed?: boolean;
  isCollapsible?: boolean; // Optional prop to disable collapse behavior
  accentColor?: string; // Tailwind border color class, e.g. 'blue-500'
}

const FeedbackSection: React.FC<FeedbackSectionProps> = ({ 
  title, 
  content, 
  initialCollapsed = false, 
  isCollapsible = true, // Default to collapsible
  accentColor = 'blue-500',
}) => {
  const [isCollapsed, setIsCollapsed] = useState(initialCollapsed);

  // Don't render if there's no content
  if (!content?.trim()) return null; 

  const sectionId = title.replace(/\s+/g, '-').toLowerCase();
  const toggleCollapse = () => {
    if (isCollapsible) setIsCollapsed(prev => !prev);
  };

  return (
    <div
      className={`flex border-l-4 bg-white dark:bg-gray-800 shadow-md hover:shadow-lg transition-shadow duration-200 overflow-hidden sm:rounded-lg ${
        // Fix for dynamic Tailwind classes that won't work with JIT compiler
        accentColor === 'green-500' ? 'border-green-500' :
        accentColor === 'yellow-500' ? 'border-yellow-500' :
        accentColor === 'red-500' ? 'border-red-500' :
        'border-blue-500' // Default
      }`}
    >
      <div className="w-full">
        <div
          id={`header-${sectionId}`}
          role={isCollapsible ? 'button' : undefined}
          aria-controls={`content-${sectionId}`}
          aria-expanded={!isCollapsed}
          tabIndex={isCollapsible ? 0 : -1}
          className={`px-4 py-4 sm:px-6 flex justify-between items-center border-b border-gray-200 dark:border-gray-700 
            ${isCollapsible ? 'cursor-pointer focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-blue-400' : ''}`}
          onClick={toggleCollapse}
          onKeyDown={e => {
            if (isCollapsible && (e.key === 'Enter' || e.key === ' ')) {
              e.preventDefault(); toggleCollapse();
            }
          }}
        >
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">{title}</h2>
          {isCollapsible && (
            <span className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
              {isCollapsed ? (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
                </svg>
              )}
            </span>
          )}
        </div>
        <div
          id={`content-${sectionId}`}
          aria-labelledby={`header-${sectionId}`}
          className={`transition-all duration-300 ease-in-out overflow-hidden 
            ${isCollapsed ? 'max-h-0 opacity-0' : 'max-h-screen opacity-100'}`}
        >
          <div className="px-4 py-5 sm:p-6">
            <div className="prose prose-sm sm:prose lg:prose-lg xl:prose-xl dark:prose-invert max-w-none prose-li:marker:text-gray-600 dark:prose-li:marker:text-gray-400 prose-em:not-italic prose-i:not-italic prose-strong:font-semibold prose-code:not-italic">
              <ReactMarkdown>{content}</ReactMarkdown>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FeedbackSection; 