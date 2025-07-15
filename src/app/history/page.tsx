'use client';

import { useState, useEffect, useRef, useCallback, useMemo, memo } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import type { Debate, SpeechFeedback } from '@/types';
import { parseFeedbackMarkdown } from '@/utils/feedbackUtils';

// Lazy load heavy components
const ErrorBoundary = dynamic(() => import('@/components/ErrorBoundary'), {
  loading: () => <LoadingSpinner />,
});

const Layout = dynamic(() => import('@/components/layout/Layout'), {
  loading: () => <LoadingSpinner fullScreen text="Loading..." />,
});

const ReactMarkdown = dynamic(() => import('react-markdown'), {
  loading: () => <div className="animate-pulse bg-gray-200 dark:bg-gray-700 h-4 w-full rounded" />,
  ssr: false,
});
import { MicrophoneIcon, ChatBubbleLeftRightIcon, PlayIcon, PauseIcon, TrashIcon, CheckCircleIcon } from '@heroicons/react/24/solid';
import { useToast } from '@/components/ui/Toast';
import { FixedSizeList as List } from 'react-window';

// Constants for pagination
const ITEMS_PER_PAGE = 50;
const INITIAL_LOAD = 100;

// Helper component for the audio player in history items
const HistoryAudioPlayer = memo(({ audioUrl }: { audioUrl: string }) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const handlePlayPause = useCallback(() => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      setError(null);
      audioRef.current.play().catch(err => {
        console.error('Playback error in history player:', err);
        setError('Unable to play audio');
        setIsPlaying(false);
      });
    }
    setIsPlaying(!isPlaying);
  }, [isPlaying]);

  const handleTimeUpdate = useCallback(() => {
    if (!audioRef.current) return;
    setCurrentTime(audioRef.current.currentTime);
  }, []);

  const handleLoadedMetadata = useCallback(() => {
    if (!audioRef.current) return;
    setDuration(audioRef.current.duration);
    setLoading(false);
  }, []);
  
  const formatTime = useCallback((time: number) => {
    if (isNaN(time) || time === Infinity) return '0:00';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  }, []);
  
  const handleSeek = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (!audioRef.current) return;
    const newTime = parseFloat(e.target.value);
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  }, []);
  
  const handleEnded = useCallback(() => {
    setIsPlaying(false);
    setCurrentTime(0);
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
    }
  }, []);

  const handleError = useCallback(() => {
    console.error('Audio loading error in history item');
    setError('Failed to load audio');
    setLoading(false);
  }, []);

  // Check for valid URL format
  useEffect(() => {
    if (!audioUrl || (!audioUrl.startsWith('http://') && !audioUrl.startsWith('https://'))) {
      setError('Invalid audio URL');
      setLoading(false);
    }
  }, [audioUrl]);

  return (
    <div className="mt-3 bg-gray-50 dark:bg-gray-700 p-3 rounded-md">
      {error ? (
        <div className="text-red-500 dark:text-red-400 py-1 text-xs">
          {error}
        </div>
      ) : loading ? (
        <div className="flex justify-center items-center py-2">
          <div className="animate-pulse text-gray-500 dark:text-gray-400 text-xs">Loading...</div>
        </div>
      ) : null}
      
      <audio 
        ref={audioRef}
        src={audioUrl} 
        className="hidden"
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
        onError={handleError}
      />
      <div className="flex items-center">
        <button 
          onClick={handlePlayPause}
          className="flex-shrink-0 w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-primary-600 hover:bg-primary-700 flex items-center justify-center text-white focus:outline-none focus:ring-1 focus:ring-primary-500 focus:ring-offset-1 disabled:opacity-50 transition-all"
          disabled={!!error || loading}
        >
          {isPlaying ? <PauseIcon className="h-4 w-4 sm:h-5 sm:w-5" /> : <PlayIcon className="h-4 w-4 sm:h-5 sm:w-5" />}
        </button>
        <div className="ml-3 flex-1">
          <input 
            type="range" 
            min="0" 
            max={duration || 0}
            step="0.1"
            value={currentTime} 
            onChange={handleSeek}
            className="w-full h-1.5 bg-gray-200 dark:bg-gray-600 rounded-lg appearance-none cursor-pointer accent-primary-600 focus:outline-none disabled:opacity-50"
            disabled={!!error || loading}
          />
        </div>
        <span className="ml-3 text-xs text-gray-500 dark:text-gray-400 min-w-[3rem] text-right">
          {formatTime(currentTime)} / {formatTime(duration)}
        </span>
      </div>
    </div>
  );
});
HistoryAudioPlayer.displayName = 'HistoryAudioPlayer';

// Memoized history item component for virtual list
interface HistoryItemData {
  item: Debate | SpeechFeedback;
  formatDate: (dateString: string) => string;
  onDelete: (id: string, type: 'speech' | 'debate') => void;
  router: any;
}

const HistoryItem = memo(({ data, index, style }: { data: HistoryItemData[], index: number, style: React.CSSProperties }) => {
  const { item, formatDate, onDelete, router } = data[index];
  
  // Determine if the item is a speech or debate
  const isSpeech = 'topic' in item && !('title' in item);
  const title = isSpeech 
    ? `Speech: ${(item as SpeechFeedback).topic}`
    : `Debate: ${(item as Debate).title || (item as Debate).topic || 'Untitled Debate'}`;
  
  return (
    <div style={style} className="px-6">
      <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg hover:shadow-lg transition-shadow duration-200 animate-fade-in">
        {/* Card Header */}
        <div className="px-4 py-4 sm:px-6 border-b border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
          <div className="flex items-center min-w-0 flex-1">
            <div className={`flex-shrink-0 h-8 w-8 sm:h-10 sm:w-10 rounded-full flex items-center justify-center ${isSpeech ? 'bg-accent-100 dark:bg-accent-700' : 'bg-primary-100 dark:bg-primary-700'}`}>
              {isSpeech ? (
                <MicrophoneIcon className="h-5 w-5 text-accent-600 dark:text-accent-300" />
              ) : (
                <ChatBubbleLeftRightIcon className="h-5 w-5 text-primary-600 dark:text-primary-300" />
              )}
            </div>
            <div className="ml-3 min-w-0 flex-1">
              <h3 className="text-sm sm:text-base font-medium text-gray-900 dark:text-gray-100 break-words" title={title}>
                {title}
              </h3>
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1">
                {formatDate(item.created_at)}
              </p>
            </div>
            {/* Speaker Score Preview for Speeches */}
            {isSpeech && (item as SpeechFeedback).feedback && (
              <div className="ml-3 flex-shrink-0">
                {(() => {
                  const feedback = (item as SpeechFeedback).feedback;
                  const score = feedback.speakerScore || feedback.scores?.overall || feedback.score;
                  if (score !== undefined && score !== null) {
                    const scoreColor = score >= 80 ? 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20' :
                                     score >= 60 ? 'text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20' :
                                                   'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20';
                    return (
                      <div className={`px-3 py-1 rounded-full ${scoreColor} font-semibold text-sm`}>
                        {Math.round(score)}/100
                      </div>
                    );
                  }
                  return null;
                })()}
              </div>
            )}
          </div>
          {/* Action Buttons */}
          <div className="flex gap-2 flex-shrink-0">
            {isSpeech ? (
              <button
                onClick={() => router.push(`/speech-feedback/${item.id}`)}
                className="px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                View Feedback
              </button>
            ) : (
              <Link 
                href={`/debate/${item.id}`}
                className="inline-flex items-center px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                View Debate
              </Link>
            )}
            <button
              onClick={() => onDelete(item.id, isSpeech ? 'speech' : 'debate')}
              className="p-1.5 sm:p-2 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-red-500"
              aria-label="Delete"
              title="Delete Item"
            >
              <TrashIcon className="h-4 w-4 sm:h-5 sm:w-5" />
            </button>
          </div>
        </div>
        {/* Card Body - Simplified for performance */}
        <div className="px-4 py-5 sm:p-6">
          {isSpeech ? (
            // Speech content - simplified
            <div className="space-y-4">
              {(item as SpeechFeedback).feedback && (
                <div>
                  <h4 className="text-sm sm:text-base font-medium mb-2">Feedback Summary</h4>
                  <div className="mt-2 text-xs sm:text-sm text-gray-700 dark:text-gray-300">
                    <p className="italic">View full feedback to see details.</p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            // Debate content - simplified
            <div className="space-y-4">
              {(item as Debate).description && (
                <div>
                  <h4 className="text-sm sm:text-base font-medium mb-2">Description</h4>
                  <p className="text-xs sm:text-sm text-gray-700 dark:text-gray-300">{(item as Debate).description}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
});
HistoryItem.displayName = 'HistoryItem';

export default function History() {
  const router = useRouter();
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [debateHistory, setDebateHistory] = useState<Debate[]>([]);
  const [speechHistory, setSpeechHistory] = useState<SpeechFeedback[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'debates' | 'speeches'>('all');
  const [itemToDelete, setItemToDelete] = useState<{ id: string, type: 'speech' | 'debate' } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteSuccess, setDeleteSuccess] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  
  const checkUser = useCallback(async (loadMore = false) => {
    try {
      if (!loadMore) {
        setLoading(true);
      } else {
        setIsLoadingMore(true);
      }
      
      const { data, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        setError('Authentication error. Please try signing in again.');
        setLoading(false);
        return;
      }
      
      if (!data.session) {
        router.push('/auth');
        return;
      }
      
      try {
        // Fetch debates with pagination
        const currentPage = loadMore ? page : 1;
        const { data: debatesData, error: debatesError } = await supabase
          .from('debate_history')
          .select('*')
          .eq('user_id', data.session.user.id)
          .order('created_at', { ascending: false })
          .range((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE - 1);
        
        if (debatesError && debatesError.code !== '42P01') {
          setError(prev => prev ? `${prev}. Failed to load debates.` : 'Failed to load debates.');
        } else {
          if (loadMore) {
            setDebateHistory(prev => [...prev, ...(debatesData || [])]);
          } else {
            setDebateHistory(debatesData || []);
          }
          
          // Check if there are more items
          if (!debatesData || debatesData.length < ITEMS_PER_PAGE) {
            setHasMore(false);
          }
        }
      } catch (debateError) {
        console.error('Exception fetching debates:', debateError);
      }

      try {
        // Fetch speech recordings with pagination
        const currentPage = loadMore ? page : 1;
        const { data: speechData, error: speechError } = await supabase
          .from('speech_feedback')
          .select('*')
          .eq('user_id', data.session.user.id)
          .order('created_at', { ascending: false })
          .range((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE - 1);
        
        if (speechError && speechError.code !== '42P01') {
          setError(prev => prev ? `${prev}. Failed to load speech history.` : 'Failed to load speech history.');
        } else {
          if (loadMore) {
            setSpeechHistory(prev => [...prev, ...(speechData || [])]);
          } else {
            setSpeechHistory(speechData || []);
          }
        }
      } catch (speechError) {
        console.error('Exception fetching speech feedback:', speechError);
      }
      
    } catch (error) {
      console.error('Error fetching user data:', error);
      setError('An unexpected error occurred. Please try again later.');
    } finally {
      setLoading(false);
      setIsLoadingMore(false);
    }
  }, [router, page]);

  useEffect(() => {
    checkUser();
    
    // Add a safeguard against infinite loading
    const loadingTimeout = setTimeout(() => {
      if (loading) {
        console.error('History page loading timed out');
        setLoading(false);
        const errorMessage = 'Loading timed out. This could be due to slow database response. Please try refreshing the page or check your network connection.';
        setError(errorMessage);
        addToast({ message: errorMessage, type: 'error' });
      }
    }, 30000); // 30 seconds timeout
    
    return () => clearTimeout(loadingTimeout);
  }, []);

  // Function to handle delete confirmation
  const handleDeleteConfirm = useCallback((id: string, type: 'speech' | 'debate') => {
    setItemToDelete({ id, type });
  }, []);

  // Function to handle delete cancellation
  const handleDeleteCancel = useCallback(() => {
    setItemToDelete(null);
  }, []);

  // Function to handle actual deletion
  const handleDeleteItem = useCallback(async () => {
    if (!itemToDelete) return;
    
    setIsDeleting(true);
    setError(null);
    setDeleteSuccess(null);
    
    try {
      const { id, type } = itemToDelete;
      
      if (type === 'speech') {
        // Get item info first to handle storage deletion
        const { data: speechItem, error: fetchError } = await supabase
          .from('speech_feedback')
          .select('audio_url')
          .eq('id', id)
          .single();
          
        if (fetchError && fetchError.code !== 'PGRST116') { // Ignore 'not found' errors
          throw new Error(`Failed to fetch item details: ${fetchError.message}`);
        }
        
        // Also delete audio file from storage if it exists
        if (speechItem?.audio_url) {
          try {
            const url = new URL(speechItem.audio_url);
            const pathParts = url.pathname.split('/');
            const storageIndex = pathParts.indexOf('storage');
            if (storageIndex !== -1 && pathParts.length > storageIndex + 4) {
              const bucketName = pathParts[storageIndex + 4]; 
              const storagePath = pathParts.slice(storageIndex + 5).join('/');
              
              if (bucketName && storagePath) {
                console.log(`Attempting to delete from bucket: ${bucketName}, path: ${storagePath}`);
                const { error: storageError } = await supabase
                  .storage
                  .from(bucketName)
                  .remove([storagePath]);
                if (storageError) {
                   console.error('Error deleting storage file:', storageError);
                   throw new Error(`Failed to delete associated audio file: ${storageError.message}`);
                }
              }
            }
          } catch (urlParseError) {
            console.error('Error parsing audio URL for deletion:', urlParseError);
          }
        }
        
        // Delete the record from the table
        const { error: deleteError } = await supabase
          .from('speech_feedback')
          .delete()
          .eq('id', id);
          
        if (deleteError) {
          throw new Error(`Failed to delete record: ${deleteError.message}`);
        }
        
        setSpeechHistory(prev => prev.filter(item => item.id !== id));
        const successMessage = 'Speech record deleted successfully';
        setDeleteSuccess(successMessage);
        addToast({ message: successMessage, type: 'success' });
      } else { // type === 'debate'
        // Delete the record from the table
        const { error: deleteError } = await supabase
          .from('debate_history')
          .delete()
          .eq('id', id);
          
        if (deleteError) {
          throw new Error(`Failed to delete record: ${deleteError.message}`);
        }
        
        setDebateHistory(prev => prev.filter(item => item.id !== id));
        const successMessage = 'Debate record deleted successfully';
        setDeleteSuccess(successMessage);
        addToast({ message: successMessage, type: 'success' });
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      console.error('Error deleting item:', error);
      const fullErrorMessage = `Failed to delete the item: ${errorMessage}`;
      setError(fullErrorMessage);
      addToast({ message: fullErrorMessage, type: 'error' });
      setIsDeleting(false); 
    } finally {
      setIsDeleting(false);
      setItemToDelete(null);
      
      if (deleteSuccess) {
         setTimeout(() => {
           setDeleteSuccess(null);
         }, 3000);
      }
    }
  }, [itemToDelete, deleteSuccess, addToast]);
  
  // Format date for display
  const formatDate = useCallback((dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  }, []);
  
  // Memoize filtered display items
  const displayItems = useMemo(() => {
    if (activeTab === 'all') {
      return [...speechHistory, ...debateHistory].sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    } else if (activeTab === 'debates') {
      return debateHistory;
    } else {
      return speechHistory;
    }
  }, [activeTab, speechHistory, debateHistory]);
  
  // Load more items
  const loadMore = useCallback(() => {
    if (!isLoadingMore && hasMore) {
      setPage(prev => prev + 1);
      checkUser(true);
    }
  }, [isLoadingMore, hasMore, checkUser]);
  
  // Prepare data for virtual list
  const itemData = useMemo(() => {
    return displayItems.map(item => ({
      item,
      formatDate,
      onDelete: handleDeleteConfirm,
      router
    }));
  }, [displayItems, formatDate, handleDeleteConfirm, router]);
  
  if (loading) {
    return <LoadingSpinner fullScreen text="Loading your history..." />;
  }
  
  return (
    <ErrorBoundary fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="max-w-md w-full bg-white dark:bg-gray-800 shadow-lg rounded-lg p-8">
          <div className="text-center">
            <h2 className="text-xl sm:text-2xl font-bold mb-4">Something went wrong</h2>
            <p className="text-sm sm:text-base text-gray-600 dark:text-gray-300 mb-6">
              We encountered an error in the history page. Please try refreshing.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 sm:px-6 sm:py-3 text-sm sm:text-base font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              Try again
            </button>
          </div>
        </div>
      </div>
    }>
      <Layout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="pb-5 border-b border-gray-200 dark:border-gray-700 sm:flex sm:items-center sm:justify-between mb-6">
            <h1 className="text-3xl font-semibold text-gray-900 dark:text-white">History</h1>
            <div className="mt-4 sm:mt-0">
              {/* Tab Navigation */}
              <div className="inline-flex rounded-md shadow-sm" role="group">
                <button
                  type="button"
                  onClick={() => setActiveTab('all')}
                  className={`px-4 py-2 text-sm font-medium rounded-l-lg border border-gray-300 dark:border-gray-600 focus:z-10 focus:ring-2 focus:ring-primary-500 focus:outline-none ${
                    activeTab === 'all'
                      ? 'bg-primary-600 text-white'
                      : 'bg-white text-gray-700 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
                  }`}
                >
                  All
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('debates')}
                  className={`px-4 py-2 text-sm font-medium border-t border-b border-gray-300 dark:border-gray-600 focus:z-10 focus:ring-2 focus:ring-primary-500 focus:outline-none ${
                    activeTab === 'debates'
                      ? 'bg-primary-600 text-white'
                      : 'bg-white text-gray-700 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
                  }`}
                >
                  Debates
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('speeches')}
                  className={`px-4 py-2 text-sm font-medium rounded-r-lg border border-gray-300 dark:border-gray-600 focus:z-10 focus:ring-2 focus:ring-primary-500 focus:outline-none ${
                    activeTab === 'speeches'
                      ? 'bg-primary-600 text-white'
                      : 'bg-white text-gray-700 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
                  }`}
                >
                  Speeches
                </button>
              </div>
            </div>
          </div>
          
          {/* Success Message */}
          {deleteSuccess && (
            <div className="mb-6 bg-green-50 dark:bg-green-900/30 border border-green-300 dark:border-green-700 rounded-md p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <CheckCircleIcon className="h-5 w-5 text-green-500 dark:text-green-400" aria-hidden="true" />
                </div>
                <div className="ml-3">
                  <p className="text-sm text-green-700 dark:text-green-200 font-medium">{deleteSuccess}</p>
                </div>
              </div>
            </div>
          )}
          
          {/* Error Message */}
          {error && (
            <div className="mb-6 bg-red-50 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded-md p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-red-500 dark:text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-red-700 dark:text-red-300 font-medium">{error}</p>
                </div>
              </div>
            </div>
          )}
          
          {/* History Items - Virtual Scrolling for performance */}
          <div className="mt-6 animate-fade-in">
            {displayItems.length > 0 ? (
              <div style={{ height: '70vh' }}>
                <List
                  height={window.innerHeight * 0.7}
                  itemCount={displayItems.length}
                  itemSize={200} // Approximate height of each item
                  width="100%"
                  itemData={itemData}
                  onScroll={({ scrollOffset, scrollUpdateWasRequested }) => {
                    // Load more when near bottom
                    const scrollPercentage = scrollOffset / (displayItems.length * 200 - window.innerHeight * 0.7);
                    if (scrollPercentage > 0.8 && !isLoadingMore && hasMore && !scrollUpdateWasRequested) {
                      loadMore();
                    }
                  }}
                >
                  {HistoryItem}
                </List>
                {isLoadingMore && (
                  <div className="text-center py-4">
                    <LoadingSpinner text="Loading more..." />
                  </div>
                )}
              </div>
            ) : (
              // Empty State
              <div className="text-center py-12 bg-white dark:bg-gray-800 shadow-md rounded-lg">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="mx-auto h-12 w-12 text-gray-400">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                </svg>
                <h3 className="mt-2 text-lg sm:text-xl font-medium">No {activeTab !== 'all' ? activeTab : 'practice history'} found</h3>
                <p className="mt-1 text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                  Get started with your first {activeTab === 'speeches' ? 'speech practice' : activeTab === 'debates' ? 'debate' : 'practice session'}.
                </p>
                <div className="mt-6 space-x-4">
                  {activeTab === 'speeches' || activeTab === 'all' ? (
                    <button
                      onClick={() => router.push('/speech-feedback')}
                      className="inline-flex items-center px-4 py-2 sm:px-6 sm:py-3 text-sm sm:text-base font-medium text-white bg-accent-600 hover:bg-accent-700 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-accent-500"
                    >
                      <MicrophoneIcon className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
                      Record Speech
                    </button>
                  ) : null}
                  
                  {activeTab === 'debates' || activeTab === 'all' ? (
                    <button
                      onClick={() => router.push('/debate')}
                      className="inline-flex items-center px-4 py-2 sm:px-6 sm:py-3 text-sm sm:text-base font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500"
                    >
                      <ChatBubbleLeftRightIcon className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
                      Start Debate
                    </button>
                  ) : null}
                </div>
              </div>
            )}
          </div>
        </div>
        
        {/* Confirmation Dialog */}
        {itemToDelete && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-75 flex items-center justify-center z-50 px-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 sm:p-6 shadow-xl max-w-sm w-full mx-auto">
              <h3 className="text-lg sm:text-xl font-semibold mb-2">Confirm Deletion</h3>
              <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mb-4 sm:mb-6">
                Are you sure you want to delete this {itemToDelete.type === 'speech' ? 'speech' : 'debate'} record? Associated audio files (if any) will also be removed. This action cannot be undone.
              </p>
              <div className="flex justify-end space-x-3">
                <button
                  onClick={handleDeleteCancel}
                  className="px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500"
                  disabled={isDeleting}
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteItem}
                  className="px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-red-500"
                  disabled={isDeleting}
                >
                  {isDeleting ? (
                    <div className="flex items-center">
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Deleting...
                    </div>
                  ) : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        )}
      </Layout>
    </ErrorBoundary>
  );
}