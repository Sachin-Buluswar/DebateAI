'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Navbar from '@/components/layout/Navbar';
import BackButton from '@/components/ui/BackButton';
import { cn } from '@/utils/cn';

interface Resource {
  id: string;
  title: string;
  slug: string;
  description: string;
  category: 'guides' | 'lessons' | 'slideshows' | 'worksheets';
  file_url: string;
  file_type: string;
  authors: string[];
  tags: string[];
  difficulty: 'beginner' | 'intermediate' | 'advanced' | null;
  duration_minutes: number | null;
  download_count: number;
  view_count: number;
  is_featured: boolean;
  created_at: string;
}

export default function ResourceViewerPage() {
  const params = useParams<{ category: string; slug: string }>();
  const [resource, setResource] = useState<Resource | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'embed' | 'download'>('embed');
  const [sessionId] = useState(() => Math.random().toString(36).substring(7));
  const [hasTrackedView, setHasTrackedView] = useState(false);

  // Construct the full file URL
  const getFullFileUrl = useCallback((fileUrl: string) => {
    if (fileUrl.startsWith('http')) {
      return fileUrl;
    }
    // For local files, construct the full URL
    const baseUrl = typeof window !== 'undefined' 
      ? `${window.location.protocol}//${window.location.host}`
      : '';
    return `${baseUrl}${fileUrl}`;
  }, []);

  // Track resource view
  const trackEvent = useCallback(async (eventType: 'view' | 'download' | 'share') => {
    if (!resource) return;

    try {
      await fetch('/api/resources/track', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          resourceId: resource.id,
          eventType,
          sessionId,
        }),
      });

      // Update local counts
      if (eventType === 'view') {
        setResource(prev => prev ? { ...prev, view_count: prev.view_count + 1 } : prev);
      } else if (eventType === 'download') {
        setResource(prev => prev ? { ...prev, download_count: prev.download_count + 1 } : prev);
      }
    } catch (err) {
      console.error('Failed to track event:', err);
    }
  }, [resource, sessionId]);

  // Fetch resource data
  useEffect(() => {
    const fetchResource = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(`/api/resources/${params?.slug}`);
        
        if (!response.ok) {
          if (response.status === 404) {
            throw new Error('Resource not found');
          }
          throw new Error('Failed to load resource');
        }

        const data = await response.json();
        setResource(data.resource);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load resource');
        console.error('Error fetching resource:', err);
      } finally {
        setLoading(false);
      }
    };

    if (params?.slug) {
      fetchResource();
    }
  }, [params?.slug]);

  // Track view once resource is loaded
  useEffect(() => {
    if (resource && !hasTrackedView) {
      trackEvent('view');
      setHasTrackedView(true);
    }
  }, [resource, hasTrackedView, trackEvent]);

  const handleDownload = () => {
    if (!resource) return;
    trackEvent('download');
    // Browser will handle the actual download
  };

  const handleShare = async () => {
    if (!resource) return;
    
    trackEvent('share');
    
    const shareData = {
      title: resource.title,
      text: resource.description,
      url: window.location.href,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        // Fallback to copying URL
        await navigator.clipboard.writeText(window.location.href);
        alert('Link copied to clipboard!');
      }
    } catch (err) {
      console.error('Error sharing:', err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-950">
        <Navbar />
        <div className="breathing-room max-w-6xl mx-auto text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading resource...</p>
        </div>
      </div>
    );
  }

  if (error || !resource) {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-950">
        <Navbar />
        <div className="breathing-room max-w-6xl mx-auto">
          <BackButton className="mb-8" />
          <div className="text-center py-12">
            <h1 className="text-2xl text-gray-900 dark:text-gray-100 mb-4">
              {error || 'Resource not found'}
            </h1>
            <Link href="/learn" className="text-primary-500 hover:text-primary-600 transition-colors">
              ← Back to all resources
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const fullFileUrl = getFullFileUrl(resource.file_url);
  const encodedUrl = encodeURIComponent(fullFileUrl);

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      <Navbar />
      
      <main className="breathing-room max-w-6xl mx-auto">
        <BackButton href="/learn" className="mb-8" />
        
        {/* Resource Header */}
        <div className="space-y-6 mb-8 animate-fade-in">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h1 className="text-gray-900 dark:text-gray-100 mb-2">
                {resource.title}
              </h1>
              <p className="text-lg text-gray-600 dark:text-gray-400 mb-4">
                {resource.description}
              </p>
            </div>
          </div>
          
          {/* Metadata */}
          <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
            {resource.authors.length > 0 && (
              <div className="flex items-center">
                <span className="mr-2">by</span>
                <span className="text-gray-900 dark:text-gray-100">
                  {resource.authors.join(', ')}
                </span>
              </div>
            )}
            
            {resource.difficulty && (
              <span className={cn(
                'px-2 py-1 rounded text-xs',
                resource.difficulty === 'beginner' && 'bg-green-100 dark:bg-green-900 text-green-600 dark:text-green-400',
                resource.difficulty === 'intermediate' && 'bg-yellow-100 dark:bg-yellow-900 text-yellow-600 dark:text-yellow-400',
                resource.difficulty === 'advanced' && 'bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-400'
              )}>
                {resource.difficulty}
              </span>
            )}
            
            {resource.duration_minutes && (
              <span className="flex items-center">
                <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {resource.duration_minutes} min
              </span>
            )}
            
            <span className="flex items-center">
              <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              {resource.view_count} views
            </span>
            
            <span className="flex items-center">
              <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
              </svg>
              {resource.download_count} downloads
            </span>
          </div>
          
          {/* Tags */}
          {resource.tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {resource.tags.map((tag) => (
                <span
                  key={tag}
                  className="px-3 py-1 text-xs bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded-full"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* View Mode Toggle */}
        <div className="flex items-center justify-between mb-6 animate-fade-in stagger-1">
          <div className="flex gap-2">
            <button
              onClick={() => setViewMode('embed')}
              className={cn(
                'px-4 py-2 rounded transition-colors',
                viewMode === 'embed'
                  ? 'bg-primary-500 text-white'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
              )}
            >
              View Online
            </button>
            <button
              onClick={() => setViewMode('download')}
              className={cn(
                'px-4 py-2 rounded transition-colors',
                viewMode === 'download'
                  ? 'bg-primary-500 text-white'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
              )}
            >
              Download
            </button>
          </div>
          
          <button
            onClick={handleShare}
            className="flex items-center px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
          >
            <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m9.032 4.026a3 3 0 10-5.432 2.684m5.432-2.684l-5.432 2.684m0-14.368a3 3 0 105.432-2.684m-5.432 2.684l5.432-2.684" />
            </svg>
            Share
          </button>
        </div>

        {/* Content Viewer */}
        <div className="animate-fade-in stagger-2">
          {viewMode === 'embed' ? (
            <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
              {resource.file_type === 'pdf' ? (
                <>
                  <iframe
                    src={`https://docs.google.com/viewer?url=${encodedUrl}&embedded=true`}
                    className="w-full h-[700px] md:h-[800px] rounded bg-white"
                    title={resource.title}
                    loading="lazy"
                  />
                  <div className="mt-4 text-center">
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                      Having trouble viewing? Try the download option below.
                    </p>
                    <a
                      href={resource.file_url}
                      download
                      onClick={handleDownload}
                      className="inline-flex items-center px-6 py-3 bg-primary-500 text-white rounded hover:bg-primary-600 transition-colors"
                    >
                      <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                      </svg>
                      Download PDF
                    </a>
                  </div>
                </>
              ) : (
                <div className="text-center py-12">
                  <p className="text-gray-600 dark:text-gray-400 mb-4">
                    This file type cannot be previewed online.
                  </p>
                  <a
                    href={resource.file_url}
                    download
                    onClick={handleDownload}
                    className="inline-flex items-center px-6 py-3 bg-primary-500 text-white rounded hover:bg-primary-600 transition-colors"
                  >
                    <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                    </svg>
                    Download {resource.file_type.toUpperCase()}
                  </a>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-12 text-center">
              <svg className="w-24 h-24 mx-auto text-gray-400 mb-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
              </svg>
              <h3 className="text-xl text-gray-900 dark:text-gray-100 mb-2">
                Download {resource.title}
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                Save this resource for offline viewing or printing.
              </p>
              <div className="space-y-4">
                <a
                  href={resource.file_url}
                  download
                  onClick={handleDownload}
                  className="inline-flex items-center px-6 py-3 bg-primary-500 text-white rounded hover:bg-primary-600 transition-colors"
                >
                  <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                  </svg>
                  Download {resource.file_type.toUpperCase()} ({resource.download_count} downloads)
                </a>
                <div>
                  <a
                    href={resource.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary-500 hover:text-primary-600 transition-colors"
                  >
                    Open in new tab →
                  </a>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}