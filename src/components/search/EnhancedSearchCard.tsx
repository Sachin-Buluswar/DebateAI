'use client';

import { useState } from 'react';
import { cn } from '@/utils/cn';

interface SearchResult {
  id: string;
  title: string;
  content: string;
  source?: string;
  relevanceScore?: number;
  highlights?: string[];
  date?: string;
  category?: string;
}

interface EnhancedSearchCardProps {
  result: SearchResult;
  onClick?: () => void;
  isSelected?: boolean;
}

export default function EnhancedSearchCard({
  result,
  onClick,
  isSelected = false
}: EnhancedSearchCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  // Calculate relevance color based on score
  const getRelevanceColor = (score?: number) => {
    if (!score) return 'bg-gray-200 dark:bg-gray-700';
    if (score >= 0.8) return 'bg-[#87A96B]';
    if (score >= 0.6) return 'bg-yellow-500';
    return 'bg-gray-400';
  };

  // Format date if provided
  const formatDate = (date?: string) => {
    if (!date) return null;
    const d = new Date(date);
    return d.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
  };

  return (
    <div
      className={cn(
        'relative border transition-all duration-300 cursor-pointer overflow-hidden group',
        isSelected 
          ? 'border-[#87A96B] shadow-lg bg-[#87A96B]/5' 
          : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900',
        isHovered && !isSelected && 'border-gray-300 dark:border-gray-600 shadow-md'
      )}
      onClick={onClick}
      onMouseEnter={() => {
        setIsHovered(true);
        setTimeout(() => setShowPreview(true), 300);
      }}
      onMouseLeave={() => {
        setIsHovered(false);
        setShowPreview(false);
      }}
    >
      {/* Relevance indicator bar */}
      {result.relevanceScore && (
        <div 
          className={cn(
            'absolute top-0 left-0 h-full w-1 transition-all duration-300',
            getRelevanceColor(result.relevanceScore),
            isHovered && 'w-2'
          )}
        />
      )}

      <div className="p-6 pl-8">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white line-clamp-2 group-hover:text-[#87A96B] transition-colors">
              {result.title}
            </h3>
            
            {/* Meta information */}
            <div className="flex items-center gap-4 mt-2 text-xs text-gray-500 dark:text-gray-400">
              {result.source && (
                <span className="flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                  </svg>
                  {result.source}
                </span>
              )}
              {result.date && (
                <span className="flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  {formatDate(result.date)}
                </span>
              )}
              {result.category && (
                <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-800 rounded-full">
                  {result.category}
                </span>
              )}
            </div>
          </div>

          {/* Relevance score badge */}
          {result.relevanceScore && (
            <div className={cn(
              'flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-all duration-300',
              result.relevanceScore >= 0.8 
                ? 'bg-[#87A96B]/20 text-[#87A96B]' 
                : result.relevanceScore >= 0.6 
                  ? 'bg-yellow-500/20 text-yellow-600 dark:text-yellow-400'
                  : 'bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-gray-400',
              isHovered && 'scale-110'
            )}>
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
              {Math.round(result.relevanceScore * 100)}%
            </div>
          )}
        </div>

        {/* Content preview */}
        <div className="space-y-3">
          {/* Main content */}
          <p className={cn(
            'text-sm text-gray-600 dark:text-gray-300 transition-all duration-300',
            showPreview ? 'line-clamp-4' : 'line-clamp-3'
          )}>
            {result.content}
          </p>

          {/* Highlights */}
          {result.highlights && result.highlights.length > 0 && (
            <div className={cn(
              'space-y-2 transition-all duration-300',
              showPreview ? 'opacity-100 max-h-40' : 'opacity-0 max-h-0 overflow-hidden'
            )}>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                key points
              </p>
              <ul className="space-y-1">
                {result.highlights.slice(0, 3).map((highlight, index) => (
                  <li 
                    key={index}
                    className="flex items-start gap-2 text-xs text-gray-600 dark:text-gray-400"
                    style={{ animationDelay: `${index * 100}ms` }}
                  >
                    <span className="flex-shrink-0 w-1 h-1 bg-[#87A96B] rounded-full mt-1.5" />
                    <span className="line-clamp-1">{highlight}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Action hint */}
        <div className={cn(
          'absolute bottom-2 right-2 flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500 transition-all duration-300',
          isHovered ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-2'
        )}>
          <span>click to view</span>
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </div>

      {/* Hover effect overlay */}
      <div 
        className={cn(
          'absolute inset-0 bg-gradient-to-r from-transparent to-[#87A96B]/5 transition-opacity duration-300',
          isHovered ? 'opacity-100' : 'opacity-0'
        )}
      />
    </div>
  );
}