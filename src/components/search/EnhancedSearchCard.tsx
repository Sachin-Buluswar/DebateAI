'use client';

import { useState } from 'react';
import { cn } from '@/utils/cn';
import type { SearchResult } from '@/types';

interface EnhancedSearchCardProps {
  result: SearchResult;
  index: number;
  searchMode: 'assistant' | 'rag';
  onViewContext?: () => void;
}

export default function EnhancedSearchCard({ 
  result, 
  index, 
  searchMode,
  onViewContext 
}: EnhancedSearchCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showMetadata, setShowMetadata] = useState(false);
  
  const metadata = (result as any).metadata;

  return (
    <div
      className={cn(
        'group relative bg-white dark:bg-gray-800/50 rounded-xl shadow-sm hover:shadow-lg',
        'border border-gray-200 dark:border-gray-700 hover:border-primary-300 dark:hover:border-primary-600',
        'transition-all duration-300 ease-out',
        'animate-fade-in-up backdrop-blur-sm'
      )}
      style={{
        animationDelay: `${Math.min(index * 50, 200)}ms`
      }}
    >
      {/* Card Header */}
      <div className="p-6 pb-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h4 className="text-base font-medium text-gray-900 dark:text-gray-100 mb-1 flex items-center gap-2">
              <span className="flex-shrink-0 text-gray-400 dark:text-gray-500">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} 
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </span>
              <span className="truncate">{result.source}</span>
            </h4>
          </div>
          
          {/* Metadata Badge */}
          <div className="flex items-center gap-2">
            {searchMode === 'rag' && metadata && (
              <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                Chunk #{metadata.chunk_index || 0}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Card Content */}
      <div className="px-6 pb-6">
        <div className={cn(
          'prose prose-sm dark:prose-invert max-w-none',
          'text-gray-700 dark:text-gray-300',
          !isExpanded && 'line-clamp-3'
        )}>
          <p className="leading-relaxed">{result.content}</p>
        </div>
        
        {/* Expand/Collapse Button */}
        {result.content.length > 200 && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="mt-3 text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 font-medium transition-colors"
          >
            {isExpanded ? 'Show less' : 'Show more'}
          </button>
        )}
      </div>

      {/* Metadata Section for RAG */}
      {searchMode === 'rag' && metadata && (
        <div className="border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={() => setShowMetadata(!showMetadata)}
            className="w-full px-6 py-3 flex items-center justify-between text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 transition-colors"
          >
            <span className="flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} 
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Document Metadata
            </span>
            <svg 
              className={cn(
                'w-4 h-4 transition-transform duration-200',
                showMetadata && 'rotate-180'
              )}
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          
          {showMetadata && (
            <div className="px-6 pb-4 space-y-2 text-sm text-gray-600 dark:text-gray-400 animate-fade-in">
              <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                <div>
                  <span className="font-medium">File ID:</span>
                  <span className="ml-2 font-mono text-xs">{metadata.file_id}</span>
                </div>
                {metadata.file_name && (
                  <div>
                    <span className="font-medium">File:</span>
                    <span className="ml-2">{metadata.file_name}</span>
                  </div>
                )}
                {metadata.page_number && (
                  <div>
                    <span className="font-medium">Page:</span>
                    <span className="ml-2">{metadata.page_number}</span>
                  </div>
                )}
                {metadata.start_char && (
                  <div className="col-span-2">
                    <span className="font-medium">Position:</span>
                    <span className="ml-2">Characters {metadata.start_char}-{metadata.end_char}</span>
                  </div>
                )}
              </div>
              
              {onViewContext && (
                <button
                  onClick={onViewContext}
                  className="mt-3 flex items-center gap-2 text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 font-medium transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} 
                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} 
                      d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                  View in PDF Context
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Assistant Mode Footer */}
      {searchMode === 'assistant' && (
        <div className="px-6 pb-4 pt-2 border-t border-gray-200 dark:border-gray-700">
          <p className="text-xs text-gray-500 dark:text-gray-400 italic flex items-center gap-1">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            AI-processed for relevance and clarity
          </p>
        </div>
      )}
      
      {/* Decorative gradient on hover */}
      <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-primary-500/5 via-transparent to-primary-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
    </div>
  );
}