'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import ErrorBoundary from '@/components/ErrorBoundary';
import { supabase } from '@/lib/supabaseClient';
import type { User, SearchResult, GeneratedAnswer } from '@/types';
import Layout from '@/components/layout/Layout';

export default function SearchPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searchHistory, setSearchHistory] = useState<
    Array<{ id: string; query: string; results_count: number; created_at: string }>
  >([]);
  const [generatedAnswer, setGeneratedAnswer] = useState<GeneratedAnswer | null>(null);
  const [searchMode, setSearchMode] = useState<'assistant' | 'rag'>('assistant');

  useEffect(() => {
    const checkUser = async () => {
      try {
        const { data, error: sessionError } = await supabase.auth.getSession();

        if (sessionError) {
          console.error('Session error:', sessionError);
          setError('Authentication error. Please try signing in again.');
          setLoading(false);
          return;
        }

        if (!data.session) {
          console.log('No session found, redirecting to auth');
          router.push('/auth');
          return;
        }

        console.log('User authenticated:', data.session.user);
        setUser(data.session.user as User);
        setLoading(false);
      } catch (error) {
        console.error('Error checking user session:', error);
        setError('Failed to authenticate user. Please try logging in again.');
        router.push('/auth');
      }
    };

    checkUser();
  }, [router]);

  // Add a function to fetch search history
  const fetchSearchHistory = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('saved_searches')
        .select('id, query, results_count, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) {
        console.error('Error fetching search history:', error);
        return;
      }

      setSearchHistory(data || []);
    } catch (error) {
      console.error('Failed to fetch search history:', error);
    }
  };

  // Fetch search history when user is loaded
  useEffect(() => {
    if (user) {
      fetchSearchHistory();
    }
  }, [user]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!query.trim()) {
      setError('Please enter a search query');
      return;
    }

    setSearching(true);
    setError(null);
    setGeneratedAnswer(null); // Reset generated answer when performing a new search

    try {
      // Create table if it doesn't exist
      const { error: tableCheckError } = await supabase
        .from('saved_searches')
        .select('id')
        .limit(1);

      if (tableCheckError && tableCheckError.code === '42P01') {
        // Table doesn't exist, create it
        const createTableQuery = `
          CREATE TABLE IF NOT EXISTS saved_searches (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            query TEXT NOT NULL,
            results_count INTEGER NOT NULL DEFAULT 0,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
          );
          
          ALTER TABLE saved_searches ENABLE ROW LEVEL SECURITY;
          
          CREATE POLICY "Users can view own saved searches" 
            ON saved_searches 
            FOR SELECT 
            USING (auth.uid() = user_id);
          
          CREATE POLICY "Users can insert own saved searches" 
            ON saved_searches 
            FOR INSERT 
            WITH CHECK (auth.uid() = user_id);
          
          CREATE INDEX IF NOT EXISTS idx_saved_searches_user_id ON saved_searches(user_id);
        `;

        // Use our API endpoint instead of the direct RPC call
        const response = await fetch('/api/sql', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ query: createTableQuery }),
        });

        if (!response.ok) {
          console.error('Error creating table:', await response.text());
          setError('Failed to create saved searches table. Please contact support.');
          setSearching(false);
          return;
        }
      }

      // Call the appropriate search API based on mode
      const searchEndpoint = searchMode === 'rag' ? '/api/wiki-rag-search' : '/api/wiki-search';
      const searchResponse = await fetch(searchEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: query,
          maxResults: 10,
          userId: user?.id,
        }),
      });

      if (!searchResponse.ok) {
        throw new Error(`Search API returned status: ${searchResponse.status}`);
      }

      const searchData = await searchResponse.json();
      // Determine search results from response: direct array, wrapper.results, or empty
      let searchResults = Array.isArray(searchData)
        ? searchData
        : Array.isArray(searchData.results)
          ? searchData.results
          : [];

      // Save the search in Supabase
      const { error: insertError } = await supabase.from('saved_searches').insert({
        user_id: user?.id,
        query: query,
        results_count: searchResults.length,
      });

      if (insertError) {
        console.error('Error saving search:', insertError);
        // Don't return an error to the user, just log it
      }

      // Set the results
      setResults(searchResults);

      // Refresh search history after successful search
      fetchSearchHistory();
    } catch (error) {
      console.error('Error performing search:', error);
      setError('An unexpected error occurred. Please try again later.');
    } finally {
      setSearching(false);
    }
  };

  const handleGenerate = async () => {
    if (results.length === 0) {
      setError('No search results available to generate an answer from.');
      return;
    }

    setGenerating(true);
    setError(null);

    try {
      // Call the wiki-generate API endpoint
      const generateResponse = await fetch('/api/wiki-generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: query,
          maxResults: 5, // Use top 5 results for generation
        }),
      });

      if (!generateResponse.ok) {
        throw new Error(`Generation API returned status: ${generateResponse.status}`);
      }

      const generatedData = await generateResponse.json();
      setGeneratedAnswer(generatedData);
    } catch (error) {
      console.error('Error generating answer:', error);
      setError('Failed to generate an answer. Please try again later.');
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return <LoadingSpinner fullScreen text="Loading..." />;
  }

  return (
    <ErrorBoundary
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
          <div className="max-w-md w-full bg-white dark:bg-gray-800 shadow-lg rounded-lg p-8">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                Something went wrong
              </h2>
              <p className="text-gray-600 dark:text-gray-300 mb-6">
                Please try refreshing or return home.
              </p>
              <button
                onClick={() => window.location.reload()}
                className="btn btn-primary"
              >
                Try again
              </button>
            </div>
          </div>
        </div>
      }
    >
      <Layout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Page Header */}
          <div className="pb-5 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
            <h1>
              Evidence Search
            </h1>
            <div className="text-sm text-gray-500 dark:text-gray-400">
              {results.length > 0 && (
                <button
                  onClick={handleGenerate}
                  disabled={generating}
                  className="btn btn-primary"
                >
                  {generating ? 'Generating...' : 'Generate Answer'}
                </button>
              )}
            </div>
          </div>

          {/* Search Mode Selection */}
          <div className="mt-4 flex items-center space-x-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Search Mode:
            </span>
            <div className="flex space-x-2">
              <button
                onClick={() => setSearchMode('assistant')}
                className={`px-3 py-2 text-sm rounded-md font-medium transition-colors ${
                  searchMode === 'assistant'
                    ? 'bg-primary-500 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
                }`}
              >
                🤖 Assistant Search
              </button>
              <button
                onClick={() => setSearchMode('rag')}
                className={`px-3 py-2 text-sm rounded-md font-medium transition-colors ${
                  searchMode === 'rag'
                    ? 'bg-primary-500 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
                }`}
              >
                📄 RAG Search
              </button>
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 max-w-md">
              {searchMode === 'assistant'
                ? 'AI-powered search with generated summaries and analysis'
                : 'Direct document search with original PDF context and chunks'}
            </div>
          </div>

          {/* Search Form */}
          <form onSubmit={handleSearch} className="mt-4 relative max-w-xl">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={
                searchMode === 'rag'
                  ? 'Search for specific document content...'
                  : 'Search for debate evidence or facts...'
              }
              className="w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-primary-500 focus:border-primary-500"
            />
            <button
              type="submit"
              disabled={searching}
              className="absolute inset-y-0 right-0 px-4 py-2 text-sm font-medium text-white bg-primary-500 hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-r-md transition-colors"
            >
              {searching ? 'Searching...' : 'Search'}
            </button>
          </form>
          {error && <p className="mt-4 text-sm text-red-600 dark:text-red-400">{error}</p>}

          {/* Search History */}
          {searchHistory.length > 0 && (
            <div className="mt-6">
              <h3 className="mb-2">
                Recent Searches
              </h3>
              <div className="overflow-x-auto">
                <div className="flex flex-wrap gap-2">
                  {searchHistory.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => {
                        setQuery(item.query);
                        handleSearch({ preventDefault: () => {} } as React.FormEvent);
                      }}
                      className="inline-flex items-center px-3 py-1 rounded text-sm bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200"
                    >
                      <span>{item.query}</span>
                      <span className="ml-1 text-xs text-gray-500 dark:text-gray-400">
                        ({item.results_count})
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Generated Answer */}
          {generatedAnswer && (
            <div className="mt-6 bg-white dark:bg-gray-800 rounded-lg shadow p-6 border-l-4 border-primary-500 animate-fade-in">
              <div className="flex justify-between items-start">
                <h3 className="mb-4">
                  AI-Generated Answer
                </h3>
                <span className="px-2 py-1 text-xs rounded-full bg-primary-100 text-primary-700 dark:bg-primary-800 dark:text-primary-200">
                  RAG-powered
                </span>
              </div>

              <div className="prose dark:prose-invert prose-sm sm:prose-base lg:prose-lg max-w-none">
                {/* Format the answer text by splitting it at source citations and adding proper formatting */}
                {generatedAnswer.answer.split(/(\[Source:[^\]]+\])/).map((part, i) => {
                  if (part.match(/\[Source:[^\]]+\]/)) {
                    return (
                      <span
                        key={i}
                        className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-primary-100 text-primary-800 dark:bg-primary-800 dark:text-primary-200"
                      >
                        {part}
                      </span>
                    );
                  }
                  return <span key={i}>{part}</span>;
                })}
              </div>

              {generatedAnswer.sources.length > 0 && (
                <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <h4 className="mb-2">
                    Sources
                  </h4>
                  <ul className="divide-y divide-gray-200 dark:divide-gray-700">
                    {generatedAnswer.sources.map((source, idx) => (
                      <li key={idx} className="py-2 flex items-start">
                        <svg
                          className="h-5 w-5 text-gray-400 mr-2 mt-0.5"
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                        >
                          <path d="M7 3a1 1 0 000 2h6a1 1 0 100-2H7zM4 7a1 1 0 011-1h10a1 1 0 110 2H5a1 1 0 01-1-1zM2 11a2 2 0 012-2h12a2 2 0 012 2v4a2 2 0 01-2 2H4a2 2 0 01-2-2v-4z" />
                        </svg>
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                          {source.source}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="mt-4 text-xs text-gray-500 dark:text-gray-400 italic">
                This answer was generated using AI based on the search results and may not be 100%
                accurate. Always verify important information.
              </div>
            </div>
          )}

          {/* Results */}
          <div className="mt-6 space-y-6">
            {results.length > 0 && (
              <div className="flex items-center justify-between">
                <h3 className="mb-2">
                  {searchMode === 'rag' ? 'RAG Search Results' : 'Assistant Search Results'} (
                  {results.length})
                </h3>
                <span
                  className="px-2 py-1 text-xs rounded-full bg-primary-100 text-primary-700 dark:bg-primary-800 dark:text-primary-200"
                >
                  {searchMode === 'rag' ? 'Raw Document Chunks' : 'AI-Enhanced'}
                </span>
              </div>
            )}
            {results.map((res, idx) => (
              <div
                key={idx}
                className={`bg-white dark:bg-gray-800 rounded-lg shadow p-6 border-l-4 border-primary-500 animate-fade-in stagger-${Math.min(idx + 1, 4)}`}
              >
                <div className="flex justify-between items-start mb-3">
                  <h4 className="text-gray-900 dark:text-white">
                    📄 {res.source}
                  </h4>
                  <div className="flex flex-col items-end space-y-1">
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      Relevance: {Math.round((res.score || 0) * 100)}%
                    </span>
                    {searchMode === 'rag' && (res as any).metadata && (
                      <span className="text-xs bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                        Chunk #{(res as any).metadata.chunk_index || 0}
                      </span>
                    )}
                  </div>
                </div>

                <div className="prose dark:prose-invert prose-sm max-w-none">
                  <p className="text-gray-700 dark:text-gray-300 mb-4 leading-relaxed">
                    {res.content}
                  </p>
                </div>

                {searchMode === 'rag' && (res as any).metadata && (
                  <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <details className="text-sm text-gray-600 dark:text-gray-400">
                      <summary className="cursor-pointer hover:text-gray-800 dark:hover:text-gray-200 font-medium">
                        📋 Document Metadata
                      </summary>
                      <div className="mt-2 space-y-1 ml-4">
                        <p>
                          <strong>File ID:</strong> {(res as any).metadata.file_id}
                        </p>
                        <p>
                          <strong>File Name:</strong> {(res as any).metadata.file_name || 'Unknown'}
                        </p>
                        {(res as any).metadata.page_number && (
                          <p>
                            <strong>Page:</strong> {(res as any).metadata.page_number}
                          </p>
                        )}
                        {(res as any).metadata.start_char && (
                          <p>
                            <strong>Position:</strong> Characters {(res as any).metadata.start_char}
                            -{(res as any).metadata.end_char}
                          </p>
                        )}
                      </div>
                    </details>
                    <button
                      className="mt-2 text-sm text-primary-500 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-200"
                      onClick={() => {
                        // Future: Implement PDF context viewer
                        alert(
                          'PDF context viewer coming soon! This will show the surrounding text from the original document.'
                        );
                      }}
                    >
                      🔍 View in PDF Context
                    </button>
                  </div>
                )}

                {searchMode === 'assistant' && (
                  <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <p className="text-xs text-gray-500 dark:text-gray-400 italic">
                      ✨ This result was processed and potentially summarized by AI for relevance
                      and clarity.
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </Layout>
    </ErrorBoundary>
  );
}
