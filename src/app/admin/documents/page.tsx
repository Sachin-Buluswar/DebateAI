'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '@/components/layout/Layout';
import { supabase } from '@/lib/supabaseClient';
import EnhancedButton from '@/components/ui/EnhancedButton';
import Toast from '@/components/ui/Toast';
import { DocumentTextIcon, ArrowPathIcon, TrashIcon } from '@heroicons/react/24/outline';
import type { Document } from '@/types/documents';

export default function AdminDocumentsPage() {
  const router = useRouter();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [scraping, setScraping] = useState(false);
  const [indexing, setIndexing] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  useEffect(() => {
    checkAdminAndLoadDocuments();
  }, []);

  const checkAdminAndLoadDocuments = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        router.push('/auth');
        return;
      }

      // Check if user is admin (you can implement your own logic)
      const isAdmin = session.user.email === 'admin@debateai.com' || 
                      session.user.email === 'claudecode@gmail.com';
      
      if (!isAdmin) {
        router.push('/');
        return;
      }

      await loadDocuments();
    } catch (error) {
      console.error('Error checking admin status:', error);
      setToast({ message: 'Error loading documents', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const loadDocuments = async () => {
    try {
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDocuments(data || []);
    } catch (error) {
      console.error('Error loading documents:', error);
      setToast({ message: 'Failed to load documents', type: 'error' });
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
      setToast({ message: `Document uploaded: ${result.fileName}`, type: 'success' });
      setSelectedFile(null);
      await loadDocuments();
    } catch (error) {
      console.error('Error uploading file:', error);
      setToast({ message: 'Failed to upload document', type: 'error' });
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

      setToast({ message: 'Document reindexed successfully', type: 'success' });
      await loadDocuments();
    } catch (error) {
      console.error('Error reindexing document:', error);
      setToast({ message: 'Failed to reindex document', type: 'error' });
    } finally {
      setIndexing(false);
    }
  };

  const handleDelete = async (documentId: string) => {
    if (!confirm('Are you sure you want to delete this document?')) return;

    try {
      const response = await fetch('/api/admin/delete-document', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId }),
      });

      if (!response.ok) throw new Error('Delete failed');

      setToast({ message: 'Document deleted successfully', type: 'success' });
      await loadDocuments();
    } catch (error) {
      console.error('Error deleting document:', error);
      setToast({ message: 'Failed to delete document', type: 'error' });
    }
  };

  const handleScrapeOpenCaseList = async () => {
    setScraping(true);
    try {
      const response = await fetch('/api/admin/scrape-opencaselist', {
        method: 'POST',
      });

      if (!response.ok) throw new Error('Scraping failed');

      setToast({ message: 'OpenCaseList scraping started', type: 'info' });
      
      // Poll for status
      const checkStatus = setInterval(async () => {
        const statusResponse = await fetch('/api/admin/scrape-status');
        const status = await statusResponse.json();
        
        if (status.pending === 0) {
          clearInterval(checkStatus);
          setScraping(false);
          setToast({ 
            message: `Scraping complete: ${status.completed} files processed`, 
            type: 'success' 
          });
          await loadDocuments();
        }
      }, 5000);
    } catch (error) {
      console.error('Error starting scrape:', error);
      setToast({ message: 'Failed to start scraping', type: 'error' });
      setScraping(false);
    }
  };

  if (loading) {
    return (
      <Layout user={null}>
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout user={null}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            Document Management
          </h1>
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
              Upload PDF Document
            </label>
            <div className="flex items-center gap-4">
              <input
                type="file"
                accept=".pdf"
                onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                className="flex-1"
              />
              <EnhancedButton
                onClick={handleFileUpload}
                disabled={!selectedFile || uploadingFile}
                loading={uploadingFile}
              >
                Upload & Index
              </EnhancedButton>
            </div>
          </div>

          {/* Scraping */}
          <div className="flex items-center gap-4">
            <EnhancedButton
              onClick={handleScrapeOpenCaseList}
              variant="secondary"
              loading={scraping}
              disabled={scraping}
            >
              {scraping ? 'Scraping OpenCaseList...' : 'Scrape OpenCaseList'}
            </EnhancedButton>
            <span className="text-sm text-gray-500">
              Download and index debate files from opencaselist.com
            </span>
          </div>
        </div>

        {/* Documents Table */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold">
              Documents ({documents.length})
            </h2>
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
                          <div className="text-sm text-gray-500">
                            {doc.file_name}
                          </div>
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
                        <span className="text-yellow-600 dark:text-yellow-400 text-sm">
                          Pending
                        </span>
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
                        <a
                          href={doc.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                        >
                          <DocumentTextIcon className="h-5 w-5" />
                        </a>
                        <button
                          onClick={() => handleDelete(doc.id)}
                          className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                        >
                          <TrashIcon className="h-5 w-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {toast && (
          <Toast
            message={toast.message}
            type={toast.type}
            onClose={() => setToast(null)}
          />
        )}
      </div>
    </Layout>
  );
}