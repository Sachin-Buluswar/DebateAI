'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { RoleProtectedRoute } from '@/components/auth/RoleProtectedRoute';
import Button from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import {
  DocumentTextIcon,
  ArrowPathIcon,
  TrashIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import type { Document } from '@/types/documents';

const AVAILABLE_YEARS = [
  2025, 2024, 2023, 2022, 2021, 2020, 2019, 2018, 2017, 2016, 2015, 2014, 2013,
];

function AdminDocumentsContent() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [scraping, setScraping] = useState(false);
  const [indexing, setIndexing] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [scrapeYears, setScrapeYears] = useState<number[]>([2025, 2024, 2023, 2022, 2021, 2020]);
  const { addToast } = useToast();
  const scrapeIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    loadDocuments();
    return () => {
      if (scrapeIntervalRef.current) clearInterval(scrapeIntervalRef.current);
    };
  }, []);

  const loadDocuments = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDocuments(data || []);
    } catch (_error) {
      addToast({ message: 'Failed to load documents', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async () => {
    if (!selectedFile) return;

    setUploadingFile(true);
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const response = await fetch('/api/admin/upload-document', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) throw new Error('Upload failed');

      const result = await response.json();
      addToast({ message: `Document uploaded: ${result.fileName}`, type: 'success' });
      setSelectedFile(null);
      await loadDocuments();
    } catch (_error) {
      addToast({ message: 'Failed to upload document', type: 'error' });
    } finally {
      setUploadingFile(false);
    }
  };

  const handleReindex = async (documentId: string) => {
    setIndexing(true);
    try {
      const response = await fetch('/api/admin/reindex-document', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId }),
      });

      if (!response.ok) throw new Error('Reindex failed');

      addToast({ message: 'Document reindexed successfully', type: 'success' });
      await loadDocuments();
    } catch (_error) {
      addToast({ message: 'Failed to reindex document', type: 'error' });
    } finally {
      setIndexing(false);
    }
  };

  const handleDelete = async (documentId: string) => {
    try {
      const response = await fetch('/api/admin/delete-document', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId }),
      });

      if (!response.ok) throw new Error('Delete failed');

      addToast({ message: 'Document deleted successfully', type: 'success' });
      setDeleteConfirmId(null);
      await loadDocuments();
    } catch (_error) {
      addToast({ message: 'Failed to delete document', type: 'error' });
    }
  };

  const toggleYear = (year: number) => {
    setScrapeYears((prev) =>
      prev.includes(year) ? prev.filter((y) => y !== year) : [...prev, year].sort((a, b) => b - a)
    );
  };

  const handleScrapeOpenCaseList = async () => {
    if (scrapeYears.length === 0) {
      addToast({ message: 'Select at least one year', type: 'error' });
      return;
    }

    setScraping(true);
    try {
      const response = await fetch('/api/admin/scrape-opencaselist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ years: scrapeYears }),
      });

      if (!response.ok) throw new Error('Scraping failed');

      addToast({ message: `Scraping started for years: ${scrapeYears.join(', ')}`, type: 'info' });

      // Poll for status with cleanup and error handling
      if (scrapeIntervalRef.current) clearInterval(scrapeIntervalRef.current);
      let failCount = 0;
      scrapeIntervalRef.current = setInterval(async () => {
        try {
          const statusResponse = await fetch('/api/admin/scrape-status');
          if (!statusResponse.ok) {
            failCount++;
            if (failCount >= 5) {
              if (scrapeIntervalRef.current) clearInterval(scrapeIntervalRef.current);
              setScraping(false);
              addToast({
                message: 'Lost connection to scrape status. Check logs for details.',
                type: 'error',
              });
            }
            return;
          }
          failCount = 0;
          const status = await statusResponse.json();

          if (status.pending === 0) {
            if (scrapeIntervalRef.current) clearInterval(scrapeIntervalRef.current);
            setScraping(false);
            addToast({
              message: `Scraping complete: ${status.completed} files processed`,
              type: 'success',
            });
            await loadDocuments();
          }
        } catch {
          failCount++;
          if (failCount >= 5) {
            if (scrapeIntervalRef.current) clearInterval(scrapeIntervalRef.current);
            setScraping(false);
            addToast({
              message: 'Lost connection to scrape status. Check logs for details.',
              type: 'error',
            });
          }
        }
      }, 10000);
    } catch (_error) {
      addToast({ message: 'Failed to start scraping', type: 'error' });
      setScraping(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Document Management</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Upload, index, and manage RAG documents
        </p>
      </div>

      {/* Actions Section */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-8">
        <h2 className="text-lg font-semibold mb-4">Actions</h2>

        {/* File Upload */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Upload PDF or TXT Document
          </label>
          <div className="flex items-center gap-4">
            <input
              type="file"
              accept=".pdf,.txt"
              onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
              className="flex-1"
            />
            <Button
              onClick={handleFileUpload}
              disabled={!selectedFile || uploadingFile}
              loading={uploadingFile}
            >
              Upload & Index
            </Button>
          </div>
        </div>

        {/* Year Selector */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Select Years to Scrape
          </label>
          <div className="flex flex-wrap gap-2">
            {AVAILABLE_YEARS.map((year) => (
              <button
                key={year}
                onClick={() => toggleYear(year)}
                disabled={scraping}
                className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                  scrapeYears.includes(year)
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
                } ${scraping ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
              >
                {year}
              </button>
            ))}
          </div>
        </div>

        {/* Scraping */}
        <div className="flex items-center gap-4">
          <Button
            onClick={handleScrapeOpenCaseList}
            variant="secondary"
            loading={scraping}
            disabled={scraping || scrapeYears.length === 0}
          >
            {scraping
              ? 'Scraping OpenCaseList...'
              : `Scrape OpenCaseList (${scrapeYears.length} years)`}
          </Button>
          <span className="text-sm text-gray-500">
            Download and index debate files from opencaselist.com via ZIP archives
          </span>
        </div>
      </div>

      {/* Documents Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold">Documents ({documents.length})</h2>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Title
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Source
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Pages
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Indexed
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {documents.map((doc) => (
                <tr key={doc.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <DocumentTextIcon className="h-5 w-5 text-gray-400 mr-2" />
                      <div>
                        <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          {doc.title}
                        </div>
                        <div className="text-sm text-gray-500">{doc.file_name}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300">
                      {doc.source_type}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {doc.page_count || 'N/A'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {doc.indexed_at ? (
                      <span className="text-green-600 dark:text-green-400 text-sm">
                        ✓ {new Date(doc.indexed_at).toLocaleDateString()}
                      </span>
                    ) : (
                      <span className="text-yellow-600 dark:text-yellow-400 text-sm">Pending</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleReindex(doc.id)}
                        className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300"
                        disabled={indexing}
                      >
                        <ArrowPathIcon className="h-5 w-5" />
                      </button>
                      {doc.file_url && (
                        <a
                          href={doc.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                        >
                          <DocumentTextIcon className="h-5 w-5" />
                        </a>
                      )}
                      {deleteConfirmId === doc.id ? (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleDelete(doc.id)}
                            className="text-xs font-medium text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                          >
                            Confirm
                          </button>
                          <button
                            onClick={() => setDeleteConfirmId(null)}
                            className="text-xs font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setDeleteConfirmId(doc.id)}
                          className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                        >
                          <TrashIcon className="h-5 w-5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default function AdminDocumentsPage() {
  return (
    <RoleProtectedRoute
      requiredRole="admin"
      unauthorizedComponent={
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <ExclamationTriangleIcon className="mx-auto h-12 w-12 text-yellow-500 mb-4" />
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">
              Access Denied
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              You don't have permission to access this page.
            </p>
            <Button onClick={() => (window.location.href = '/')} variant="primary">
              Return to Home
            </Button>
          </div>
        </div>
      }
    >
      <AdminDocumentsContent />
    </RoleProtectedRoute>
  );
}
