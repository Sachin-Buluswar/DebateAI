'use client';

import { useState } from 'react';
import { MagnifyingGlassIcon, BookOpenIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';

interface SearchResult {
  title: string;
  excerpt: string;
  relevanceScore: number;
  source: string;
  metadata?: Record<string, unknown>;
}

interface WikiSearchPanelProps {
  debateTopic: string;
  userPerspective: 'PRO' | 'CON';
  isVisible: boolean;
  onToggle: () => void;
}

export function WikiSearchPanel({ debateTopic, userPerspective, isVisible, onToggle }: WikiSearchPanelProps) {
  const [query, setQuery] = useState('');
  const [searchType, setSearchType] = useState<'evidence' | 'context' | 'counterarguments' | 'expert'>('evidence');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async () => {
    if (!query.trim()) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/wiki-search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: query.trim(),
          debateTopic,
          perspective: searchType === 'counterarguments' ? 
            (userPerspective === 'PRO' ? 'CON' : 'PRO') : 
            userPerspective,
          type: searchType,
          maxResults: 5
        }),
      });

      const data = await response.json();

      if (data.success) {
        setResults(data.results);
      } else {
        setError(data.error || 'Search failed');
      }
    } catch (err) {
      setError('Network error during search');
      console.error('Search error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const getSearchTypeIcon = (type: string) => {
    switch (type) {
      case 'context':
        return <BookOpenIcon className="w-4 h-4" />;
      case 'counterarguments':
        return <ExclamationTriangleIcon className="w-4 h-4" />;
      default:
        return <MagnifyingGlassIcon className="w-4 h-4" />;
    }
  };

  const getSearchTypeLabel = (type: string) => {
    switch (type) {
      case 'evidence':
        return 'Supporting Evidence';
      case 'context':
        return 'Topic Context';
      case 'counterarguments':
        return 'Counter-Arguments';
      case 'expert':
        return 'Expert Opinions';
      default:
        return type;
    }
  };

  if (!isVisible) {
    return (
      <button
        onClick={onToggle}
        className="fixed right-2 lg:right-4 top-1/2 transform -translate-y-1/2 bg-primary-500 text-white p-2 lg:p-3 rounded-l-lg shadow-lg hover:bg-primary-600 transition-colors z-50"
        title="Open Research Panel"
      >
        <MagnifyingGlassIcon className="w-5 h-5 lg:w-6 lg:h-6" />
      </button>
    );
  }

  return (
    <div className="fixed right-0 top-0 h-screen w-full sm:w-96 bg-white dark:bg-gray-800 shadow-2xl border-l border-gray-200 dark:border-gray-700 z-40 flex flex-col">
      {/* Header */}
      <div className="bg-primary-500 text-white p-4 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <MagnifyingGlassIcon className="w-5 h-5" />
          <h3 className="font-semibold">Research Panel</h3>
        </div>
        <button
          onClick={onToggle}
          className="text-primary-100 hover:text-white transition-colors"
          title="Close Research Panel"
        >
          ✕
        </button>
      </div>

      {/* Search Controls */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 space-y-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Search Type
          </label>
          <select
            value={searchType}
            onChange={(e) => setSearchType(e.target.value as 'evidence' | 'context' | 'counterarguments' | 'expert')}
            className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value="evidence">Supporting Evidence</option>
            <option value="context">Topic Context</option>
            <option value="counterarguments">Counter-Arguments</option>
            <option value="expert">Expert Opinions</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Search Query
          </label>
          <div className="flex space-x-2">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Enter your search terms..."
              className="flex-1 p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
            <button
              onClick={handleSearch}
              disabled={isLoading || !query.trim()}
              className="px-4 py-2 bg-primary-500 text-white rounded-md hover:bg-primary-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? '...' : 'Search'}
            </button>
          </div>
        </div>

        <div className="text-xs text-gray-500 dark:text-gray-400">
          Topic: <span className="font-medium">{debateTopic}</span>
        </div>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto p-4">
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-3 mb-4">
            <p className="text-red-700 dark:text-red-400 text-sm">{error}</p>
          </div>
        )}

        {isLoading && (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
            <span className="ml-3 text-gray-600 dark:text-gray-400">Searching...</span>
          </div>
        )}

        {results.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
              {getSearchTypeIcon(searchType)}
              <span>{getSearchTypeLabel(searchType)} Results</span>
            </div>

            {results.map((result, index) => (
              <div key={index} className="border border-gray-200 dark:border-gray-600 rounded-lg p-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                <div className="flex items-start justify-between mb-2">
                  <h4 className="font-medium text-gray-900 dark:text-white text-sm leading-tight">
                    {result.title}
                  </h4>
                  <div className="ml-2 px-2 py-1 bg-primary-100 dark:bg-primary-800 text-primary-700 dark:text-primary-200 text-xs rounded-full flex-shrink-0">
                    {Math.round(result.relevanceScore * 100)}%
                  </div>
                </div>
                
                <p className="text-gray-700 dark:text-gray-300 text-sm mb-2 leading-relaxed">
                  {result.excerpt}
                </p>
                
                <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                  <span className="truncate">{result.source}</span>
                  <button
                    onClick={() => {
                      if (result.source.startsWith('http')) {
                        window.open(result.source, '_blank');
                      }
                    }}
                    className="text-primary-500 dark:text-primary-400 hover:underline ml-2 flex-shrink-0"
                  >
                    View Source
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {!isLoading && !error && results.length === 0 && query && (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            <MagnifyingGlassIcon className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No results found for your search.</p>
            <p className="text-sm mt-1">Try different keywords or search type.</p>
          </div>
        )}

        {!query && (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            <BookOpenIcon className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="font-medium mb-2">Research Your Arguments</p>
            <p className="text-sm">Search for evidence, expert opinions, and context to strengthen your debate position.</p>
          </div>
        )}
      </div>
    </div>
  );
} 