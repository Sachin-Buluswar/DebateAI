'use client';

import { useState, useEffect } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';

// Import CSS files - TypeScript will ignore these
// @ts-ignore
import 'react-pdf/dist/Page/AnnotationLayer.css';
// @ts-ignore
import 'react-pdf/dist/Page/TextLayer.css';
import { 
  XMarkIcon, 
  ArrowLeftIcon, 
  ArrowRightIcon,
  MagnifyingGlassPlusIcon,
  MagnifyingGlassMinusIcon,
  ArrowDownTrayIcon,
  ArrowsPointingOutIcon,
  ArrowsPointingInIcon
} from '@heroicons/react/24/outline';

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

interface EnhancedPDFViewerProps {
  pdfUrl: string;
  title?: string;
  initialPage?: number;
  onClose?: () => void;
  className?: string;
  showDownload?: boolean;
}

export function EnhancedPDFViewer({ 
  pdfUrl, 
  title = 'PDF Document',
  initialPage = 1, 
  onClose,
  className = '',
  showDownload = true
}: EnhancedPDFViewerProps) {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pageNumber, setPageNumber] = useState(initialPage);
  const [scale, setScale] = useState(1.0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pageWidth, setPageWidth] = useState<number>(800);

  // Calculate page width based on container
  useEffect(() => {
    const updatePageWidth = () => {
      const containerWidth = window.innerWidth;
      if (containerWidth < 640) {
        setPageWidth(containerWidth - 40); // Mobile
      } else if (containerWidth < 1024) {
        setPageWidth(Math.min(containerWidth - 80, 700)); // Tablet
      } else {
        setPageWidth(Math.min(containerWidth - 200, 900)); // Desktop
      }
    };

    updatePageWidth();
    window.addEventListener('resize', updatePageWidth);
    return () => window.removeEventListener('resize', updatePageWidth);
  }, []);

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setLoading(false);
    setError(null);
  };

  const onDocumentLoadError = (error: Error) => {
    // PRODUCTION: Console disabled
    // console.error('PDF loading error:', error);
    setError('Failed to load PDF. Please try downloading the file instead.');
    setLoading(false);
  };

  const changePage = (offset: number) => {
    setPageNumber(prevPageNumber => {
      const newPage = prevPageNumber + offset;
      if (newPage >= 1 && numPages && newPage <= numPages) {
        return newPage;
      }
      return prevPageNumber;
    });
  };

  const handleZoomIn = () => {
    setScale(prevScale => Math.min(prevScale + 0.25, 3));
  };

  const handleZoomOut = () => {
    setScale(prevScale => Math.max(prevScale - 0.25, 0.5));
  };

  const handleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = pdfUrl;
    link.download = title || 'document.pdf';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const containerClass = isFullscreen 
    ? 'fixed inset-0 z-50 bg-white dark:bg-gray-900'
    : `bg-white dark:bg-gray-900 rounded-lg shadow-xl ${className}`;

  return (
    <div className={containerClass}>
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 truncate max-w-xs sm:max-w-md">
              {title}
            </h3>
            {numPages && (
              <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
                <span>Page {pageNumber} of {numPages}</span>
              </div>
            )}
          </div>
          
          <div className="flex items-center space-x-2">
            {/* Zoom controls */}
            <button
              onClick={handleZoomOut}
              className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              title="Zoom out"
            >
              <MagnifyingGlassMinusIcon className="h-5 w-5" />
            </button>
            <span className="text-sm text-gray-600 dark:text-gray-400 min-w-[3rem] text-center">
              {Math.round(scale * 100)}%
            </span>
            <button
              onClick={handleZoomIn}
              className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              title="Zoom in"
            >
              <MagnifyingGlassPlusIcon className="h-5 w-5" />
            </button>
            
            {/* Fullscreen toggle */}
            <button
              onClick={handleFullscreen}
              className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
            >
              {isFullscreen ? (
                <ArrowsPointingInIcon className="h-5 w-5" />
              ) : (
                <ArrowsPointingOutIcon className="h-5 w-5" />
              )}
            </button>
            
            {/* Download button */}
            {showDownload && (
              <button
                onClick={handleDownload}
                className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                title="Download PDF"
              >
                <ArrowDownTrayIcon className="h-5 w-5" />
              </button>
            )}
            
            {/* Close button */}
            {onClose && (
              <button
                onClick={onClose}
                className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                title="Close"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* PDF Content */}
      <div className="flex-1 overflow-auto bg-gray-50 dark:bg-gray-900">
        {loading && (
          <div className="flex items-center justify-center h-96">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
              <p className="text-gray-600 dark:text-gray-400">Loading PDF...</p>
            </div>
          </div>
        )}

        {error && (
          <div className="flex items-center justify-center h-96">
            <div className="text-center">
              <p className="text-red-600 dark:text-red-400 mb-4">{error}</p>
              {showDownload && (
                <button
                  onClick={handleDownload}
                  className="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                >
                  <ArrowDownTrayIcon className="h-5 w-5 mr-2" />
                  Download PDF Instead
                </button>
              )}
            </div>
          </div>
        )}

        {!error && (
          <Document
            file={pdfUrl}
            onLoadSuccess={onDocumentLoadSuccess}
            onLoadError={onDocumentLoadError}
            loading={
              <div className="flex justify-center items-center h-96">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
              </div>
            }
            className="flex justify-center"
          >
            <Page
              pageNumber={pageNumber}
              scale={scale}
              width={pageWidth}
              className="shadow-lg"
              renderTextLayer={true}
              renderAnnotationLayer={true}
            />
          </Document>
        )}
      </div>

      {/* Footer with navigation */}
      {numPages && numPages > 1 && !error && (
        <div className="sticky bottom-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 px-4 py-3">
          <div className="flex items-center justify-center space-x-4">
            <button
              onClick={() => changePage(-1)}
              disabled={pageNumber <= 1}
              className="inline-flex items-center px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ArrowLeftIcon className="h-4 w-4 mr-1" />
              Previous
            </button>
            
            <div className="flex items-center space-x-2">
              <input
                type="number"
                min={1}
                max={numPages}
                value={pageNumber}
                onChange={(e) => {
                  const page = parseInt(e.target.value, 10);
                  if (page >= 1 && page <= numPages) {
                    setPageNumber(page);
                  }
                }}
                className="w-16 px-2 py-1 text-center text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              <span className="text-sm text-gray-600 dark:text-gray-400">
                / {numPages}
              </span>
            </div>
            
            <button
              onClick={() => changePage(1)}
              disabled={pageNumber >= numPages}
              className="inline-flex items-center px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Next
              <ArrowRightIcon className="h-4 w-4 ml-1" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Inline PDF viewer for embedding in pages
export function InlinePDFViewer({ 
  pdfUrl, 
  title,
  height = '700px',
  showControls = true 
}: { 
  pdfUrl: string; 
  title?: string;
  height?: string;
  showControls?: boolean;
}) {
  return (
    <div style={{ height }} className="w-full">
      <EnhancedPDFViewer
        pdfUrl={pdfUrl}
        title={title}
        showDownload={showControls}
        className="h-full"
      />
    </div>
  );
}