'use client';

import { useState, useEffect } from 'react';
import { XMarkIcon, ArrowLeftIcon, ArrowRightIcon } from '@heroicons/react/24/outline';

interface PDFViewerProps {
  pdfUrl: string;
  pageNumber?: number;
  highlightText?: string;
  onClose: () => void;
}

export function PDFViewer({ pdfUrl, pageNumber = 1, highlightText, onClose }: PDFViewerProps) {
  const [currentPage, setCurrentPage] = useState(pageNumber);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setCurrentPage(pageNumber);
  }, [pageNumber]);

  const handleIframeLoad = () => {
    setIsLoading(false);
  };

  const handleIframeError = () => {
    setError('Failed to load PDF. Please try downloading the file instead.');
    setIsLoading(false);
  };

  // Construct PDF.js viewer URL with parameters
  const getPdfViewerUrl = () => {
    // Use PDF.js viewer with page parameter
    const baseUrl = `/pdfjs/web/viewer.html`;
    const params = new URLSearchParams({
      file: pdfUrl,
    });

    if (currentPage > 1) {
      params.append('page', currentPage.toString());
    }

    if (highlightText) {
      params.append('search', highlightText);
      params.append('highlight', 'true');
    }

    return `${baseUrl}?${params.toString()}`;
  };

  const navigatePage = (delta: number) => {
    setCurrentPage(prev => Math.max(1, prev + delta));
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
      <div className="relative w-full h-full max-w-7xl bg-white rounded-lg shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-4">
            <h3 className="text-lg font-semibold">PDF Viewer</h3>
            {currentPage && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => navigatePage(-1)}
                  className="p-1 hover:bg-gray-100 rounded"
                  disabled={currentPage <= 1}
                >
                  <ArrowLeftIcon className="h-5 w-5" />
                </button>
                <span className="text-sm text-gray-600">Page {currentPage}</span>
                <button
                  onClick={() => navigatePage(1)}
                  className="p-1 hover:bg-gray-100 rounded"
                >
                  <ArrowRightIcon className="h-5 w-5" />
                </button>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <a
              href={pdfUrl}
              download
              className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Download PDF
            </a>
            <button
              onClick={onClose}
              className="p-1 hover:bg-gray-100 rounded"
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>
        </div>

        {/* PDF Content */}
        <div className="flex-1 relative">
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-50">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-600">Loading PDF...</p>
              </div>
            </div>
          )}

          {error ? (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-50">
              <div className="text-center">
                <p className="text-red-600 mb-4">{error}</p>
                <a
                  href={pdfUrl}
                  download
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Download PDF Instead
                </a>
              </div>
            </div>
          ) : (
            <iframe
              src={getPdfViewerUrl()}
              className="w-full h-full"
              onLoad={handleIframeLoad}
              onError={handleIframeError}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// Simple PDF viewer for environments without PDF.js
export function SimplePDFViewer({ pdfUrl, pageNumber, onClose }: PDFViewerProps) {
  const pdfUrlWithPage = pageNumber ? `${pdfUrl}#page=${pageNumber}` : pdfUrl;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
      <div className="relative w-full h-full max-w-7xl bg-white rounded-lg shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-semibold">PDF Document</h3>
          <div className="flex items-center gap-2">
            <a
              href={pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Open in New Tab
            </a>
            <a
              href={pdfUrl}
              download
              className="px-3 py-1 text-sm bg-gray-600 text-white rounded hover:bg-gray-700"
            >
              Download
            </a>
            <button
              onClick={onClose}
              className="p-1 hover:bg-gray-100 rounded"
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>
        </div>

        {/* PDF Embed */}
        <div className="flex-1">
          <embed
            src={pdfUrlWithPage}
            type="application/pdf"
            className="w-full h-full"
          />
        </div>
      </div>
    </div>
  );
}