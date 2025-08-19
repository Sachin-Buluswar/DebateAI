'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
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

const categoryInfo = {
  slideshows: {
    icon: '📊',
    title: 'slideshows',
    description: 'Visual presentations for easy learning',
    color: 'text-blue-500',
  },
  guides: {
    icon: '📖',
    title: 'guides',
    description: 'Step-by-step tutorials for debate concepts',
    color: 'text-green-500',
  },
  lessons: {
    icon: '🎯',
    title: 'lesson plans',
    description: 'Structured curricula for coaches & students',
    color: 'text-purple-500',
  },
  worksheets: {
    icon: '📝',
    title: 'worksheets',
    description: 'Practice materials and exercises',
    color: 'text-orange-500',
  },
};

function ResourceCard({ resource }: { resource: Resource }) {
  const categoryData = categoryInfo[resource.category];
  
  return (
    <Link
      href={`/learn/${resource.category}/${resource.slug}`}
      className="block group"
    >
      <div className="p-6 border border-gray-200 dark:border-gray-800 rounded-lg hover:border-primary-500 transition-all duration-200 h-full">
        <div className="flex items-start justify-between mb-4">
          <span className="text-2xl">{categoryData.icon}</span>
          {resource.is_featured && (
            <span className="text-xs px-2 py-1 bg-primary-100 dark:bg-primary-900 text-primary-600 dark:text-primary-400 rounded">
              featured
            </span>
          )}
        </div>
        
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2 group-hover:text-primary-500 transition-colors">
          {resource.title}
        </h3>
        
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 line-clamp-2">
          {resource.description}
        </p>
        
        <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-500">
          <div className="flex items-center space-x-4">
            {resource.difficulty && (
              <span className={cn(
                'px-2 py-1 rounded',
                resource.difficulty === 'beginner' && 'bg-green-100 dark:bg-green-900 text-green-600 dark:text-green-400',
                resource.difficulty === 'intermediate' && 'bg-yellow-100 dark:bg-yellow-900 text-yellow-600 dark:text-yellow-400',
                resource.difficulty === 'advanced' && 'bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-400'
              )}>
                {resource.difficulty}
              </span>
            )}
            {resource.duration_minutes && (
              <span>{resource.duration_minutes} min</span>
            )}
          </div>
          <div className="flex items-center space-x-3">
            <span className="flex items-center">
              <svg className="w-3 h-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              {resource.view_count}
            </span>
            <span className="flex items-center">
              <svg className="w-3 h-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
              </svg>
              {resource.download_count}
            </span>
          </div>
        </div>
        
        {resource.authors.length > 0 && (
          <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-800">
            <p className="text-xs text-gray-500 dark:text-gray-500">
              by {resource.authors.join(', ')}
            </p>
          </div>
        )}
      </div>
    </Link>
  );
}

export default function LearnPage() {
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedDifficulty, setSelectedDifficulty] = useState<string | null>(null);

  useEffect(() => {
    fetchResources();
  }, [selectedCategory, selectedDifficulty]);

  const fetchResources = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const params = new URLSearchParams();
      if (selectedCategory) params.append('category', selectedCategory);
      if (selectedDifficulty) params.append('difficulty', selectedDifficulty);
      
      const response = await fetch(`/api/resources?${params}`);
      const data = await response.json();
      
      // Handle response regardless of status
      if (data.resources) {
        setResources(data.resources);
        // Check for setup message
        if (data.message) {
          setMessage(data.message);
        } else {
          setMessage(null);
        }
      } else if (data.error) {
        throw new Error(data.error);
      } else {
        setResources([]);
      }
    } catch (err) {
      setError('Failed to load resources. Please try again later.');
      // PRODUCTION: Console disabled
      // console.error('Error fetching resources:', err);
    } finally {
      setLoading(false);
    }
  };

  const featuredResources = resources.filter(r => r.is_featured);
  const regularResources = resources.filter(r => !r.is_featured);

  return (
    <main className="breathing-room max-w-6xl mx-auto">
      {/* Header */}
      <div className="space-y-6 mb-12 animate-fade-in">
        <h1 className="text-gray-900 dark:text-gray-100">
          learn debate fundamentals
        </h1>
        <p className="text-xl text-gray-600 dark:text-gray-400 max-w-3xl">
          free resources created by nationally-ranked debaters to help you master public forum debate
        </p>
      </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-4 mb-8 animate-fade-in stagger-1">
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-600 dark:text-gray-400">category:</span>
            <div className="flex space-x-2">
              <button
                onClick={() => setSelectedCategory(null)}
                className={cn(
                  'px-3 py-1 text-sm rounded transition-colors',
                  !selectedCategory
                    ? 'bg-primary-500 text-white'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                )}
              >
                all
              </button>
              {Object.keys(categoryInfo).map((category) => (
                <button
                  key={category}
                  onClick={() => setSelectedCategory(category)}
                  className={cn(
                    'px-3 py-1 text-sm rounded transition-colors',
                    selectedCategory === category
                      ? 'bg-primary-500 text-white'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                  )}
                >
                  {category}
                </button>
              ))}
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-600 dark:text-gray-400">difficulty:</span>
            <div className="flex space-x-2">
              <button
                onClick={() => setSelectedDifficulty(null)}
                className={cn(
                  'px-3 py-1 text-sm rounded transition-colors',
                  !selectedDifficulty
                    ? 'bg-primary-500 text-white'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                )}
              >
                all
              </button>
              {['beginner', 'intermediate', 'advanced'].map((difficulty) => (
                <button
                  key={difficulty}
                  onClick={() => setSelectedDifficulty(difficulty)}
                  className={cn(
                    'px-3 py-1 text-sm rounded transition-colors',
                    selectedDifficulty === difficulty
                      ? 'bg-primary-500 text-white'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                  )}
                >
                  {difficulty}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
            <p className="mt-4 text-gray-600 dark:text-gray-400">Loading resources...</p>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6 text-center">
            <p className="text-red-600 dark:text-red-400">{error}</p>
            <button
              onClick={fetchResources}
              className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
            >
              Try Again
            </button>
          </div>
        )}
        
        {/* Setup Message */}
        {!loading && !error && message && resources.length === 0 && (
          <div className="bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800 rounded-lg p-8 text-center animate-fade-in">
            <div className="text-4xl mb-4">📚</div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
              {message}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              We're preparing amazing educational content for you. Check back in a few moments!
            </p>
          </div>
        )}

        {/* Featured Resources */}
        {!loading && !error && !message && featuredResources.length > 0 && (
          <section className="mb-12 animate-fade-in stagger-2">
            <h2 className="text-2xl text-gray-900 dark:text-gray-100 mb-6">
              featured resources
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {featuredResources.map((resource) => (
                <ResourceCard key={resource.id} resource={resource} />
              ))}
            </div>
          </section>
        )}

        {/* All Resources */}
        {!loading && !error && !message && regularResources.length > 0 && (
          <section className="animate-fade-in stagger-3">
            <h2 className="text-2xl text-gray-900 dark:text-gray-100 mb-6">
              {selectedCategory ? categoryInfo[selectedCategory as keyof typeof categoryInfo]?.title : 'all resources'}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {regularResources.map((resource) => (
                <ResourceCard key={resource.id} resource={resource} />
              ))}
            </div>
          </section>
        )}
        
        {/* Empty State (with filters) */}
        {!loading && !error && !message && resources.length === 0 && (selectedCategory || selectedDifficulty) && (
          <div className="text-center py-12 animate-fade-in">
            <div className="text-4xl mb-4">🔍</div>
            <p className="text-gray-600 dark:text-gray-400">
              No resources found matching your filters.
            </p>
            <button
              onClick={() => {
                setSelectedCategory(null);
                setSelectedDifficulty(null);
              }}
              className="mt-4 text-primary-500 hover:text-primary-600 transition-colors"
            >
              Clear filters
            </button>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && resources.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-600 dark:text-gray-400">
              No resources found matching your filters.
            </p>
            <button
              onClick={() => {
                setSelectedCategory(null);
                setSelectedDifficulty(null);
              }}
              className="mt-4 text-primary-500 hover:text-primary-600 transition-colors"
            >
              Clear filters
            </button>
          </div>
        )}
    </main>
  );
}