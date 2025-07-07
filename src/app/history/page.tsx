'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import ErrorBoundary from '@/components/ErrorBoundary';
import Link from 'next/link';
import type { Debate, SpeechFeedback } from '@/types';
import Layout from '@/components/layout/Layout';
import { parseFeedbackMarkdown } from '@/utils/feedbackUtils';
import ReactMarkdown from 'react-markdown';
import { MicrophoneIcon, ChatBubbleLeftRightIcon, PlayIcon, PauseIcon, TrashIcon, CheckCircleIcon } from '@heroicons/react/24/solid';

// Helper component for the audio player in history items
function HistoryAudioPlayer({ audioUrl }: { audioUrl: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const handlePlayPause = () => {
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
  };

  const handleTimeUpdate = () => {
    if (!audioRef.current) return;
    setCurrentTime(audioRef.current.currentTime);
  };

  const handleLoadedMetadata = () => {
    if (!audioRef.current) return;
    setDuration(audioRef.current.duration);
    setLoading(false);
  };
  
  const formatTime = (time: number) => {
    if (isNaN(time) || time === Infinity) return '0:00';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };
  
  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!audioRef.current) return;
    const newTime = parseFloat(e.target.value);
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };
  
  const handleEnded = () => {
    setIsPlaying(false);
    setCurrentTime(0);
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
    }
  };

  const handleError = () => {
    console.error('Audio loading error in history item');
    setError('Failed to load audio');
    setLoading(false);
  };

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
          className="flex-shrink-0 w-8 h-8 rounded-full bg-primary-600 hover:bg-primary-700 flex items-center justify-center text-white focus:outline-none focus:ring-1 focus:ring-primary-500 focus:ring-offset-1 disabled:opacity-50"
          disabled={!!error || loading}
        >
          {isPlaying ? <PauseIcon className="h-4 w-4" /> : <PlayIcon className="h-4 w-4" />}
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
}

export default function History() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [debateHistory, setDebateHistory] = useState<Debate[]>([]);
  const [speechHistory, setSpeechHistory] = useState<SpeechFeedback[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'debates' | 'speeches'>('all');
  const [itemToDelete, setItemToDelete] = useState<{ id: string, type: 'speech' | 'debate' } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteSuccess, setDeleteSuccess] = useState<string | null>(null);
  
  const checkUser = useCallback(async () => {
    try {
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
        // Fetch debates
        const { data: debatesData, error: debatesError } = await supabase
          .from('debate_history')
          .select('*')
          .eq('user_id', data.session.user.id)
          .order('created_at', { ascending: false });
        
        if (debatesError && debatesError.code !== '42P01') {
          setError(prev => prev ? `${prev}. Failed to load debates.` : 'Failed to load debates.');
        } else {
          setDebateHistory(debatesData || []);
        }
      } catch (debateError) {
        console.error('Exception fetching debates:', debateError);
      }

      try {
        // Fetch speech recordings
        const { data: speechData, error: speechError } = await supabase
          .from('speech_feedback')
          .select('*')
          .eq('user_id', data.session.user.id)
          .order('created_at', { ascending: false });
        
        if (speechError && speechError.code !== '42P01') {
          setError(prev => prev ? `${prev}. Failed to load speech history.` : 'Failed to load speech history.');
        } else {
          setSpeechHistory(speechData || []);
        }
      } catch (speechError) {
        console.error('Exception fetching speech feedback:', speechError);
      }
      
    } catch (error) {
      console.error('Error fetching user data:', error);
      setError('An unexpected error occurred. Please try again later.');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    checkUser();
    
    // Add a safeguard against infinite loading
    const loadingTimeout = setTimeout(() => {
      if (loading) {
        console.error('History page loading timed out');
        setLoading(false);
        setError('Loading timed out. This could be due to slow database response. Please try refreshing the page or check your network connection.');
      }
    }, 30000); // 30 seconds timeout (increased from 10s)
    
    return () => clearTimeout(loadingTimeout);
  }, [checkUser, loading]);

  // Function to handle delete confirmation
  const handleDeleteConfirm = (id: string, type: 'speech' | 'debate') => {
    setItemToDelete({ id, type });
  };

  // Function to handle delete cancellation
  const handleDeleteCancel = () => {
    setItemToDelete(null);
  };

  // Function to handle actual deletion
  const handleDeleteItem = async () => {
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
            // Ensure 'storage', 'v1', 'object', 'public', bucketName exist
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
                   // Throw error instead of just warning
                   console.error('Error deleting storage file:', storageError);
                   throw new Error(`Failed to delete associated audio file: ${storageError.message}`);
                }
              } else {
                console.warn('Could not reliably parse storage path from URL:', speechItem.audio_url);
                // Decide if this should be a hard error or just a warning
                // For now, let's log a warning and proceed with DB deletion, but this could be changed.
              }
            } else {
               console.warn('Could not find expected structure in storage URL path:', speechItem.audio_url);
            }
          } catch (urlParseError) {
            console.error('Error parsing audio URL for deletion:', urlParseError);
            // Decide if this should stop the deletion
            // throw new Error('Failed to parse audio URL for deletion.'); 
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
        setDeleteSuccess('Speech record deleted successfully');
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
        setDeleteSuccess('Debate record deleted successfully');
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      console.error('Error deleting item:', error);
      setError(`Failed to delete the item: ${errorMessage}`);
      // Ensure loading state is reset even if error occurs mid-process
      // Note: setItemToDelete(null) is now primarily handled in finally
      setIsDeleting(false); 
    } finally {
      // This block runs whether the try succeeded or failed (after catch)
      setIsDeleting(false); // Explicitly ensure loading spinner stops
      setItemToDelete(null); // Explicitly ensure modal closes
      
      // Clear success message after a few seconds
      // Only set timeout if deleteSuccess has a value
      if (deleteSuccess) { // Check moved from try block
         setTimeout(() => {
           setDeleteSuccess(null);
         }, 3000);
      }
    }
  };
  
  if (loading) {
    return <LoadingSpinner fullScreen text="Loading your history..." />;
  }
  
  // Format date for display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };
  
  const displayItems = activeTab === 'all' 
    ? [...speechHistory, ...debateHistory].sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )
    : activeTab === 'debates' 
        ? debateHistory
        : speechHistory;
  
  return (
    <ErrorBoundary fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="max-w-md w-full bg-white dark:bg-gray-800 shadow-lg rounded-lg p-8">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Something went wrong</h2>
            <p className="text-gray-600 dark:text-gray-300 mb-6">
              We encountered an error in the history page. Please try refreshing.
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
    }>
      <Layout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="pb-5 border-b border-gray-200 dark:border-gray-700 sm:flex sm:items-center sm:justify-between mb-6">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">History</h1>
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
          
          {/* History Items */}
          <div className="mt-6 space-y-6">
            {displayItems.length > 0 ? (
              displayItems.map((item, index) => {
                // Determine if the item is a speech or debate
                const isSpeech = 'topic' in item && !('title' in item);
                const title = isSpeech 
                  ? `Speech: ${(item as SpeechFeedback).topic}`
                  : `Debate: ${(item as Debate).title || (item as Debate).topic || 'Untitled Debate'}`;
                
                return (
                  <div key={`${item.id || index}`} className="bg-white dark:bg-gray-800 shadow-md rounded-lg overflow-hidden hover:shadow-lg transition-shadow duration-200">
                    {/* Card Header */}
                    <div className="px-4 py-4 sm:px-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
                      <div className="flex items-center min-w-0">
                        <div className={`flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center ${isSpeech ? 'bg-accent-100 dark:bg-accent-700' : 'bg-primary-100 dark:bg-primary-700'}`}>
                          {isSpeech ? (
                            <MicrophoneIcon className="h-5 w-5 text-accent-600 dark:text-accent-300" />
                          ) : (
                            <ChatBubbleLeftRightIcon className="h-5 w-5 text-primary-600 dark:text-primary-300" />
                          )}
                        </div>
                        <div className="ml-3 min-w-0">
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-white truncate" title={title}>
                            {title}
                          </h3>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {formatDate(item.created_at)}
                          </p>
                        </div>
                      </div>
                      {/* Action Buttons */}
                      <div className="flex space-x-2 flex-shrink-0 ml-4">
                        {isSpeech ? (
                          <button
                            onClick={() => router.push(`/speech-feedback/${item.id}`)}
                            className="btn btn-primary btn-sm text-xs px-3 py-1"
                          >
                            View Feedback
                          </button>
                        ) : (
                          <Link 
                            href={`/debate/${item.id}`}
                            className="btn btn-primary btn-sm text-xs px-3 py-1"
                          >
                            View Debate
                          </Link>
                        )}
                        <button
                          onClick={() => handleDeleteConfirm(item.id, isSpeech ? 'speech' : 'debate')}
                          className="btn btn-danger btn-sm text-xs p-1.5"
                          aria-label="Delete"
                          title="Delete Item"
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                    {/* Card Body */}
                    <div className="px-4 py-5 sm:p-6">
                      {isSpeech ? (
                        // Speech content
                        <div className="space-y-4">
                          {(item as SpeechFeedback).audio_url && typeof (item as SpeechFeedback).audio_url === 'string' ? (
                            <div>
                              <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Audio Recording</h4>
                              {/* Check if audio_url is actually a non-empty string before rendering */}
                              {(item as SpeechFeedback).audio_url && (
                                <HistoryAudioPlayer audioUrl={(item as SpeechFeedback).audio_url!} /> 
                              )}
                            </div>
                          ) : null /* Render nothing if no valid audio_url */}
                          
                          {(item as SpeechFeedback).feedback && (
                            <div>
                              <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Feedback Summary</h4>
                              <div className="mt-2 text-sm text-gray-700 dark:text-gray-300">
                                {(() => {
                                  const parsedSections = parseFeedbackMarkdown(item.feedback?.overall);
                                  const summary = parsedSections['Overall Summary'];
                                  
                                  if (summary) {
                                    return (
                                      <div className="prose prose-sm dark:prose-invert max-w-none">
                                         <ReactMarkdown 
                                            components={{ 
                                              p: ({...props}) => <p className="my-1" {...props} />,
                                              ul: ({...props}) => <ul className="list-disc list-inside my-1" {...props} />,
                                              li: ({...props}) => <li className="my-0.5" {...props} />
                                            }}
                                          >
                                            {summary.length > 400 ? summary.substring(0, 400) + '...' : summary}
                                          </ReactMarkdown>
                                      </div>
                                    );
                                  } else if (item.feedback?.overall) {
                                    // Fallback: show truncated raw feedback if summary section not found
                                    const truncated = item.feedback.overall.length > 400 
                                                    ? item.feedback.overall.substring(0, 400) + '...' 
                                                    : item.feedback.overall;
                                    return (
                                       <div className="prose prose-sm dark:prose-invert max-w-none">
                                          <ReactMarkdown 
                                             components={{ p: ({...props}) => <p className="my-1" {...props} /> }}
                                          >
                                            {truncated}
                                          </ReactMarkdown>
                                       </div>
                                    );
                                  } else {
                                    return <p className="italic">No feedback summary available.</p>;
                                  }
                                })()}
                              </div>
                            </div>
                          )}
                          {!(item as SpeechFeedback).audio_url && !(item as SpeechFeedback).feedback && (
                             <p className="text-sm text-gray-500 dark:text-gray-400 italic">No audio or feedback available for this entry.</p>
                          )}
                        </div>
                      ) : (
                        // Debate content
                        <div className="space-y-4">
                          {(item as Debate).description && (
                            <div>
                              <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Description</h4>
                              <p className="text-gray-700 dark:text-gray-300">{(item as Debate).description}</p>
                            </div>
                          )}
                          
                          {(item as Debate).transcript && (
                            <div>
                              <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Transcript Preview</h4>
                              <div className="bg-gray-50 dark:bg-gray-900 rounded-md p-3 text-xs text-gray-600 dark:text-gray-400 font-mono overflow-hidden">
                                {(() => {
                                  try {
                                    // Check if transcript is a non-empty string before parsing
                                    const transcriptString = (item as Debate).transcript;
                                    if (typeof transcriptString === 'string' && transcriptString.trim() !== '') {
                                      const transcriptArray = JSON.parse(transcriptString);
                                      const firstMessage = Array.isArray(transcriptArray) && transcriptArray.length > 0 ? transcriptArray[0]?.content : null;
                                      return firstMessage 
                                        ? firstMessage.substring(0, 150) + (firstMessage.length > 150 ? '...' : '') 
                                        : 'Transcript available, view details.';
                                    } else {
                                      return 'No transcript preview available.';
                                    }
                                  } catch (e) {
                                    console.error("Error parsing transcript preview:", e);
                                    return 'Could not parse transcript preview.';
                                  }
                                })()}
                              </div>
                            </div>
                          )}
                          {!(item as Debate).description && !(item as Debate).transcript && (
                             <p className="text-sm text-gray-500 dark:text-gray-400 italic">No description or transcript preview available.</p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              // Empty State
              <div className="text-center py-12 bg-white dark:bg-gray-800 shadow-md rounded-lg">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="mx-auto h-12 w-12 text-gray-400">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                </svg>
                <h3 className="mt-2 text-lg font-semibold text-gray-900 dark:text-white">No {activeTab !== 'all' ? activeTab : 'practice history'} found</h3>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  Get started with your first {activeTab === 'speeches' ? 'speech practice' : activeTab === 'debates' ? 'debate' : 'practice session'}.
                </p>
                <div className="mt-6 space-x-4">
                  {activeTab === 'speeches' || activeTab === 'all' ? (
                    <button
                      onClick={() => router.push('/speech-feedback')}
                      className="btn btn-accent"
                    >
                      <MicrophoneIcon className="w-5 h-5 mr-2" />
                      Record Speech
                    </button>
                  ) : null}
                  
                  {activeTab === 'debates' || activeTab === 'all' ? (
                    <button
                      onClick={() => router.push('/debate')}
                      className="btn btn-primary"
                    >
                      <ChatBubbleLeftRightIcon className="w-5 h-5 mr-2" />
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
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-xl max-w-sm w-full">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Confirm Deletion</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                Are you sure you want to delete this {itemToDelete.type === 'speech' ? 'speech' : 'debate'} record? Associated audio files (if any) will also be removed. This action cannot be undone.
              </p>
              <div className="flex justify-end space-x-3">
                <button
                  onClick={handleDeleteCancel}
                  className="btn btn-secondary"
                  disabled={isDeleting}
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteItem}
                  className="btn btn-danger"
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