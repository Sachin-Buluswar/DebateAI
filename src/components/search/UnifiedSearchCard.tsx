'use client';

import { useState } from 'react';
import { cn } from '@/utils/cn';
import { SimplePDFViewer } from './PDFViewer';
import { DocumentTextIcon } from '@heroicons/react/24/outline';

interface UnifiedSearchResult {
  content: string;
  source?: string;
  score?: number;
  // PDF metadata (available in both Document Search and AI Assistant modes)
  pdfUrl?: string;
  pdf_url?: string; // Support both naming conventions
  pageNumber?: number;
  page_number?: number; // Support both naming conventions
  documentId?: string;
  document_id?: string; // Support both naming conventions
  chunkId?: string;
  chunk_id?: string; // Support both naming conventions
  pdf_page_anchor?: string;
  // Document Search specific
  context?: {
    before: string;
    after: string;
  };
  metadata?: {
    title?: string;
    section?: string;
    source_type?: string;
    indexed_at?: string;
    // Legacy metadata
    file_id?: string;
    file_name?: string;
    chunk_index?: number;
  };
}

interface UnifiedSearchCardProps {
  result: UnifiedSearchResult;
  index: number;
  searchMode: 'assistant' | 'rag';
}

export default function UnifiedSearchCard({ 
  result, 
  index, 
  searchMode 
}: UnifiedSearchCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showContext, setShowContext] = useState(false);
  const [showPdfViewer, setShowPdfViewer] = useState(false);

  // Support both naming conventions
  const pdfUrl = result.pdfUrl || result.pdf_url;
  const pageNumber = result.pageNumber || result.page_number;
  const documentId = result.documentId || result.document_id;
  const chunkId = result.chunkId || result.chunk_id;

  const hasContext = result.context && (result.context.before || result.context.after);
  const hasPdfLink = pdfUrl && pdfUrl.length > 0;

  return (
    <>
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
                <DocumentTextIcon className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                <span className="truncate">{result.source || 'Unknown Document'}</span>
              </h4>
              {result.metadata?.section && (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Section: {result.metadata.section}
                </p>
              )}
            </div>
            
            {/* Badges */}
            <div className="flex items-center gap-2">
              {pageNumber && (
                <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300">
                  Page {pageNumber}
                </span>
              )}
              {result.score && (
                <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                  {Math.round(result.score * 100)}% match
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
          
          {/* Action Buttons */}
          <div className="mt-4 flex flex-wrap gap-3">
            {result.content.length > 200 && (
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 font-medium transition-colors"
              >
                {isExpanded ? 'Show less' : 'Show more'}
              </button>
            )}
            
            {hasContext && searchMode === 'rag' && (
              <button
                onClick={() => setShowContext(!showContext)}
                className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 font-medium transition-colors"
              >
                {showContext ? 'Hide context' : 'Show surrounding context'}
              </button>
            )}
            
            {hasPdfLink && (
              <button
                onClick={() => setShowPdfViewer(true)}
                className="text-sm bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 transition-colors flex items-center gap-1"
              >
                <DocumentTextIcon className="w-4 h-4" />
                View in PDF
              </button>
            )}
          </div>
          
          {/* Surrounding Context (Document Search mode only) */}
          {showContext && hasContext && searchMode === 'rag' && (
            <div className="mt-4 space-y-3 animate-fade-in">
              {result.context!.before && (
                <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Before:</p>
                  <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-3">
                    {result.context!.before}
                  </p>
                </div>
              )}
              
              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border-2 border-blue-200 dark:border-blue-800">
                <p className="text-xs font-medium text-blue-600 dark:text-blue-400 mb-1">Matched chunk:</p>
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  {result.content.substring(0, 200)}...
                </p>
              </div>
              
              {result.context!.after && (
                <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">After:</p>
                  <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-3">
                    {result.context!.after}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 pb-4 pt-2 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
            <div className="flex items-center gap-3">
              {searchMode === 'assistant' && (
                <span className="flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                      d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  AI-processed for relevance
                </span>
              )}
              {searchMode === 'rag' && (
                <span className="flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                      d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                  Direct from document
                </span>
              )}
            </div>
            {result.metadata?.indexed_at && (
              <span>Indexed: {new Date(result.metadata.indexed_at).toLocaleDateString()}</span>
            )}
          </div>
        </div>
        
        {/* Decorative gradient on hover */}
        <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-primary-500/5 via-transparent to-primary-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
      </div>

      {/* PDF Viewer Modal */}
      {showPdfViewer && hasPdfLink && (
        <SimplePDFViewer
          pdfUrl={pdfUrl!}
          pageNumber={pageNumber}
          onClose={() => setShowPdfViewer(false)}
        />
      )}
    </>
  );
}