'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import dynamic from 'next/dynamic';
import { supabase } from '@/lib/supabaseClient';
import type { User, SearchResult, GeneratedAnswer } from '@/types';
import type { EnhancedSearchResult } from '@/types/documents';

// Lazy load heavy components
const ErrorBoundary = dynamic(() => import('@/components/ErrorBoundary'), {
  loading: () => <LoadingSpinner />,
});

const Layout = dynamic(() => import('@/components/layout/Layout'), {
  loading: () => <LoadingSpinner fullScreen text="Loading..." />,
});

const UnifiedSearchCard = dynamic(() => import('@/components/search/UnifiedSearchCard'), {
  loading: () => <div className="animate-pulse bg-gray-200 dark:bg-gray-700 h-32 rounded-lg" />,
  ssr: false,
});
import EnhancedInput from '@/components/ui/EnhancedInput';
import EnhancedButton from '@/components/ui/EnhancedButton';

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
  const [searchMode, setSearchMode] = useState<'assistant' | 'rag'>('rag');
  const [showRecentSearches, setShowRecentSearches] = useState(true);

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

  // Add function to delete a search from history
  const deleteSearchHistory = async (searchId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('saved_searches')
        .delete()
        .eq('id', searchId)
        .eq('user_id', user.id);

      if (error) {
        console.error('Error deleting search:', error);
        return;
      }

      // Refresh search history
      fetchSearchHistory();
    } catch (error) {
      console.error('Failed to delete search:', error);
    }
  };

  // Function to truncate long search queries
  const truncateQuery = (query: string, maxLength: number = 50) => {
    if (query.length <= maxLength) return query;
    return query.substring(0, maxLength) + '...';
  };

  // Function to upsert search history (update if exists, insert if new)
  const upsertSearchHistory = async (searchQuery: string, resultsCount: number) => {
    if (!user) return;

    try {
      // First, check if this exact query already exists
      const { data: existingSearch, error: selectError } = await supabase
        .from('saved_searches')
        .select('id')
        .eq('user_id', user.id)
        .eq('query', searchQuery.trim())
        .single();

      if (selectError && selectError.code !== 'PGRST116') {
        console.error('Error checking existing search:', selectError);
        return;
      }

      if (existingSearch) {
        // Update existing entry with new timestamp and results count
        const { error: updateError } = await supabase
          .from('saved_searches')
          .update({
            results_count: resultsCount,
            created_at: new Date().toISOString() // Update timestamp to move to top
          })
          .eq('id', existingSearch.id);

        if (updateError) {
          console.error('Error updating search:', updateError);
        }
      } else {
        // Insert new entry
        const { error: insertError } = await supabase
          .from('saved_searches')
          .insert({
            user_id: user.id,
            query: searchQuery.trim(),
            results_count: resultsCount,
          });

        if (insertError) {
          console.error('Error inserting search:', insertError);
        }
      }
    } catch (error) {
      console.error('Failed to upsert search history:', error);
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

      // Call the appropriate search API based on mode
      const searchEndpoint = searchMode === 'rag' 
        ? '/api/wiki-document-search' 
        : '/api/wiki-search';
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
      const searchResults = Array.isArray(searchData)
        ? searchData
        : Array.isArray(searchData.results)
          ? searchData.results
          : [];

      // This is now handled by upsertSearchHistory function
      // (removed duplicate search saving code)

      // Set the results
      setResults(searchResults);

      // Update or create search history entry
      await upsertSearchHistory(query, searchResults.length);

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
                <EnhancedButton
                  onClick={handleGenerate}
                  loading={generating}
                  variant="primary"
                  size="sm"
                  icon={
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} 
                        d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  }
                >
                  {generating ? 'Generating...' : 'Generate Answer'}
                </EnhancedButton>
              )}
            </div>
          </div>

          {/* Search Mode Selection */}
          <div className="mt-4 flex items-center space-x-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Search Mode:
            </span>
            <div className="flex space-x-2">
              <EnhancedButton
                onClick={() => setSearchMode('rag')}
                variant={searchMode === 'rag' ? 'primary' : 'secondary'}
                size="sm"
                icon={<span>📎</span>}
              >
                Document Search
              </EnhancedButton>
              <EnhancedButton
                onClick={() => setSearchMode('assistant')}
                variant={searchMode === 'assistant' ? 'primary' : 'secondary'}
                size="sm"
                icon={<span>🤖</span>}
              >
                AI Assistant
              </EnhancedButton>
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 max-w-md">
              {searchMode === 'rag'
                ? 'Search documents directly and view full context'
                : 'AI analyzes documents and generates comprehensive answers'}
            </div>
          </div>

          {/* Search Form - Main Focus */}
          <div className="mt-6 bg-gradient-to-r from-primary-50 to-primary-100 dark:from-primary-900/20 dark:to-primary-800/20 rounded-2xl p-6 border border-primary-200 dark:border-primary-700">
            <div className="text-center mb-4">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2 flex items-center justify-center gap-2">
                <svg className="w-6 h-6 text-primary-600 dark:text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} 
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                Enter your search query
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Search for evidence, facts, or specific document content to support your arguments
              </p>
            </div>
            <form onSubmit={handleSearch} className="max-w-3xl mx-auto">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1 min-w-0">
                  <EnhancedInput
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={
                      searchMode === 'rag'
                        ? 'Search documents directly...'
                        : 'Ask the AI assistant a question...'
                    }
                    label="Search query"
                    className="text-lg resize-none"
                  />
                </div>
                <EnhancedButton
                  type="submit"
                  loading={searching}
                  variant="primary"
                  size="lg"
                  className="px-8 w-full sm:w-auto flex-shrink-0"
                  icon={
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} 
                        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  }
                >
                  {searching ? 'Searching...' : 'Search'}
                </EnhancedButton>
              </div>
            </form>
          </div>
          {error && <p className="mt-4 text-sm text-red-600 dark:text-red-400">{error}</p>}

          {/* Search History */}
          {searchHistory.length > 0 && (
            <div className="mt-6">
              <div className="flex items-center justify-between mb-2">
                <button
                  onClick={() => setShowRecentSearches(!showRecentSearches)}
                  className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100"
                >
                  <svg 
                    className={`w-4 h-4 transition-transform ${showRecentSearches ? 'rotate-90' : ''}`}
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                  Recent Searches ({searchHistory.length})
                </button>
                <button
                  onClick={() => {
                    if (confirm('Are you sure you want to clear all recent searches?')) {
                      Promise.all(searchHistory.map(item => deleteSearchHistory(item.id))).then(() => {
                        setSearchHistory([]);
                      });
                    }
                  }}
                  className="text-xs text-gray-500 dark:text-gray-400 hover:text-red-500 dark:hover:text-red-400"
                >
                  Clear All
                </button>
              </div>
              {showRecentSearches && (
                <div className="overflow-x-auto">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {searchHistory.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 group transition-all duration-200 min-w-0 box-border"
                      >
                        <button
                          onClick={() => {
                            setQuery(item.query);
                            handleSearch({ preventDefault: () => {} } as React.FormEvent);
                          }}
                          className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 rounded-l-lg hover:text-primary-600 dark:hover:text-primary-400 transition-colors flex-1 min-w-0"
                          title={item.query}
                        >
                          <svg className="w-3 h-3 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} 
                              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span className="truncate flex-1 break-words">{truncateQuery(item.query, 30)}</span>
                        </button>
                        <button
                          onClick={() => deleteSearchHistory(item.id)}
                          className="px-2 py-2 text-gray-400 hover:text-red-500 dark:hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all duration-200 border-l border-gray-200 dark:border-gray-600 flex-shrink-0"
                          title="Delete this search"
                        >
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Generated Answer */}
          {generatedAnswer && (
            <div className="mt-8 bg-white dark:bg-gray-800/50 rounded-xl shadow-lg p-8 border border-gray-200 dark:border-gray-700 animate-fade-in-up backdrop-blur-sm">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2 mb-2">
                    <svg className="w-6 h-6 text-primary-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} 
                        d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    AI-Generated Answer
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Synthesized from {generatedAnswer.sources.length} sources
                  </p>
                </div>
                <span className="px-3 py-1.5 text-xs font-medium rounded-full bg-primary-100 text-primary-700 dark:bg-primary-800 dark:text-primary-200">
                  AI-Generated
                </span>
              </div>

              <div className="prose dark:prose-invert prose-sm sm:prose-base max-w-none mt-6">
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
                <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
                  <h4 className="text-base font-medium text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
                    <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} 
                        d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                    Sources
                  </h4>
                  <div className="grid gap-3">
                    {generatedAnswer.sources.map((source, idx) => (
                      <div key={idx} className="flex items-start gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700">
                        <svg
                          className="h-5 w-5 text-primary-500 mt-0.5 flex-shrink-0"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} 
                            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <span className="text-sm text-gray-700 dark:text-gray-300">
                          {source.source}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-6 p-3 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800">
                <p className="text-xs text-yellow-800 dark:text-yellow-200 flex items-start gap-2">
                  <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} 
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  This answer was generated using AI based on the search results and may not be 100%
                  accurate. Always verify important information.</p>
              </div>
            </div>
          )}

          {/* Results */}
          <div className="mt-8 space-y-4">
            {results.length > 0 && (
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  {searchMode === 'rag' ? 'Document Search Results' : 'AI Assistant Results'} (
                  {results.length})
                </h3>
                <span
                  className="px-3 py-1 text-xs font-medium rounded-full bg-primary-100 text-primary-700 dark:bg-primary-800 dark:text-primary-200"
                >
                  {searchMode === 'rag' ? 'Document Search' : 'AI-Enhanced'}
                </span>
              </div>
            )}
            {results.map((res, idx) => (
              <UnifiedSearchCard
                key={idx}
                result={res}
                index={idx}
                searchMode={searchMode}
              />
            ))}
          </div>
        </div>
      </Layout>
    </ErrorBoundary>
  );
}
