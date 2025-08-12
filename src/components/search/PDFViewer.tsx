'use client';

import { useState } from 'react';
import { EnhancedPDFViewer } from '@/components/pdf/EnhancedPDFViewer';
import { XMarkIcon } from '@heroicons/react/24/outline';

interface PDFViewerProps {
  pdfUrl: string;
  pageNumber?: number;
  highlightText?: string;
  onClose: () => void;
}

export function PDFViewer({ pdfUrl, pageNumber = 1, highlightText, onClose }: PDFViewerProps) {
  const [useGoogleViewer, setUseGoogleViewer] = useState(false);

  // If the native viewer fails, we can fall back to Google Docs viewer
  const handleFallback = () => {
    setUseGoogleViewer(true);
  };

  if (useGoogleViewer) {
    return <GoogleDocsPDFViewer pdfUrl={pdfUrl} pageNumber={pageNumber} onClose={onClose} />;
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
      <div className="relative w-full h-full max-w-7xl bg-white rounded-lg shadow-2xl flex flex-col">
        <EnhancedPDFViewer
          pdfUrl={pdfUrl}
          title="PDF Document"
          initialPage={pageNumber}
          onClose={onClose}
          className="w-full h-full"
          showDownload={true}
        />
      </div>
    </div>
  );
}

// Google Docs Viewer as fallback
function GoogleDocsPDFViewer({ pdfUrl, pageNumber = 1, onClose }: PDFViewerProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const handleIframeLoad = () => {
    setIsLoading(false);
  };

  const handleIframeError = () => {
    setError('Failed to load PDF with Google Docs viewer. Please try downloading the file instead.');
    setIsLoading(false);
  };

  // Construct Google Docs viewer URL
  const getGoogleViewerUrl = () => {
    const encodedUrl = encodeURIComponent(pdfUrl);
    return `https://docs.google.com/viewer?url=${encodedUrl}&embedded=true`;
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
      <div className="relative w-full h-full max-w-7xl bg-white rounded-lg shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-4">
            <h3 className="text-lg font-semibold">PDF Viewer (Google Docs)</h3>
            {pageNumber && (
              <span className="text-sm text-gray-600">Page {pageNumber}</span>
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
              src={getGoogleViewerUrl()}
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

// Simple PDF viewer for environments without PDF.js (keeping for backward compatibility)
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