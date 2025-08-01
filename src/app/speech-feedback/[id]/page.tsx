'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import dynamic from 'next/dynamic';
import type { SpeechFeedback } from '@/types';
import { parseFeedbackMarkdown, convertStructuredFeedbackToMarkdown, StructuredFeedback } from '@/utils/feedbackUtils';

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

const FeedbackSection = dynamic(() => import('@/components/feedback/FeedbackSection'), {
  loading: () => <div className="animate-pulse bg-gray-200 dark:bg-gray-700 h-32 rounded-lg" />,
  ssr: false,
});
import { PlayIcon, PauseIcon, ArrowLeftIcon } from '@heroicons/react/24/solid';

// Helper component for the audio player
function AudioPlayer({ audioUrl }: { audioUrl: string }) {
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
      // Reset error state when attempting to play
      setError(null);
      audioRef.current.play().catch(err => {
        console.error('Playback error:', err);
        setError('Unable to play audio. The file may be corrupted or inaccessible.');
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
    console.error('Audio loading error');
    setError('Failed to load audio file. The file may be missing or inaccessible.');
    setLoading(false);
  };

  // Verify the URL format is valid
  useEffect(() => {
    if (!audioUrl || (!audioUrl.startsWith('http://') && !audioUrl.startsWith('https://'))) {
      setError('Invalid audio URL format');
      setLoading(false);
    }
  }, [audioUrl]);

  return (
    <div className="mt-4 bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800/50 dark:to-gray-700/50 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
      {error ? (
        <div className="text-red-500 dark:text-red-400 py-2 text-sm flex items-center justify-center">
          {error}
          <button 
            onClick={() => {
              setError(null);
              setLoading(true);
              if (audioRef.current) {
                audioRef.current.load(); // Attempt to reload
              }
            }}
            className="ml-2 text-primary-600 hover:text-primary-700 underline font-medium"
          >
            Try again
          </button>
        </div>
      ) : loading ? (
        <div className="flex justify-center items-center py-6">
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-primary-600 rounded-full animate-bounce"></div>
            <div className="w-2 h-2 bg-primary-600 rounded-full animate-bounce" style={{ animationDelay: '100ms' }}></div>
            <div className="w-2 h-2 bg-primary-600 rounded-full animate-bounce" style={{ animationDelay: '200ms' }}></div>
            <span className="ml-2 text-gray-500 dark:text-gray-400">Loading audio...</span>
          </div>
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
        preload="metadata" // Important for getting duration quickly
      />
      {!error && !loading && (
        <div className="flex items-center space-x-4">
          <button 
            onClick={handlePlayPause}
            className="flex-shrink-0 w-14 h-14 rounded-full bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 flex items-center justify-center text-white shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-primary-500/30 disabled:opacity-50"
            aria-label={isPlaying ? 'Pause' : 'Play'}
            disabled={!!error || loading}
          >
            {isPlaying ? <PauseIcon className="h-6 w-6" /> : <PlayIcon className="h-6 w-6 ml-0.5" />}
          </button>
          <div className="flex-1 space-y-2">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full h-2 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-primary-400 to-primary-600 rounded-full transition-all duration-300"
                    style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
                  ></div>
                </div>
              </div>
              <input 
                type="range" 
                min="0" 
                max={duration || 0}
                step="0.1"
                value={currentTime} 
                onChange={handleSeek}
                className="relative w-full h-2 opacity-0 cursor-pointer z-10"
                aria-label="Audio progress"
                disabled={!!error || loading}
              />
            </div>
            <div className="flex justify-between items-center text-sm font-medium">
              <span className="text-gray-600 dark:text-gray-400">{formatTime(currentTime)}</span>
              <span className="text-gray-500 dark:text-gray-500">{formatTime(duration)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function SpeechFeedbackDetail({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<SpeechFeedback | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    const checkUser = async () => {
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
        
        // Fetch speech feedback
        const { data: feedbackData, error: feedbackError } = await supabase
          .from('speech_feedback')
          .select('*')
          .eq('id', params.id)
          .eq('user_id', data.session.user.id)
          .single();
        
        if (feedbackError) {
          console.error('Error fetching speech feedback:', feedbackError);
          if (feedbackError.code === 'PGRST116') { // Not found
             setError('Speech feedback not found. It may have been deleted or you may not have permission to view it.');
          } else {
             setError('Failed to load speech feedback. Please try again.');
          }
          setLoading(false);
          return;
        }
        
        setFeedback(feedbackData as SpeechFeedback);
      } catch (error) {
        console.error('Error loading feedback details:', error);
        setError('An unexpected error occurred. Please try again later.');
      } finally {
        setLoading(false);
      }
    };
    
    checkUser();
  }, [router, params.id]);
  
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
  
  const formatSpeechType = (type: string | undefined | null): string => {
    if (!type) return 'Speech';
    // Example: Adjust if your speech_type values differ
    const typeMappings: { [key: string]: string } = {
      'Constructive': 'Constructive', 
      'Rebuttal': 'Rebuttal', 
      'Cross-Examination': 'Cross-Examination', 
      'Summary': 'Summary', 
      'Final Focus': 'Final Focus'
      // Add other types as needed
    };
    return typeMappings[type] || type.charAt(0).toUpperCase() + type.slice(1);
  };
  
  // Parse the feedback when available - handle both old and new formats
  let parsedFeedbackSections: { [key: string]: string } = {};
  
  if (feedback?.feedback) {
    // Check if it's the new structured format
    if (feedback.feedback.speakerScore !== undefined && feedback.feedback.structureOrganization) {
      // New structured format
      parsedFeedbackSections = convertStructuredFeedbackToMarkdown(feedback.feedback as StructuredFeedback);
    } else if (feedback.feedback.overall) {
      // Old format with overall string
      parsedFeedbackSections = parseFeedbackMarkdown(feedback.feedback.overall);
    } else if (feedback.feedback.overallSummary) {
      // New format but might be missing some fields - convert what we have
      try {
        parsedFeedbackSections = convertStructuredFeedbackToMarkdown(feedback.feedback as StructuredFeedback);
      } catch (_e) {
        // Fallback to treating overallSummary as markdown
        parsedFeedbackSections = parseFeedbackMarkdown(feedback.feedback.overallSummary);
      }
    }
  }
  
  // Add a function to handle exporting feedback
  const handleExportFeedback = () => {
    if (!feedback) return;
    
    // Create content for export
    const title = `## Speech Feedback: ${feedback.topic}\n`;
    const metadata = `- Date: ${formatDate(feedback.created_at)}\n- Type: ${formatSpeechType(feedback.speech_type || feedback.speech_types)}\n\n`;
    
    let content = '';
    
    // Export based on format
    if (Object.keys(parsedFeedbackSections).length > 0) {
      // Export parsed sections
      for (const [heading, sectionContent] of Object.entries(parsedFeedbackSections)) {
        content += `### ${heading}\n\n${sectionContent}\n\n`;
      }
    } else if (feedback.feedback?.overall) {
      // Old format
      content = feedback.feedback.overall;
    } else if (feedback.feedback?.overallSummary) {
      // New format - export as structured text
      content = feedback.feedback.overallSummary;
    }
    
    // Combine all content
    const exportContent = `# Speech Feedback Export\n\n${title}${metadata}${content}`;
    
    // Create a blob and download link
    const blob = new Blob([exportContent], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `speech-feedback-${formatDateForFilename(feedback.created_at)}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };
  
  // Helper function to format date for filename
  const formatDateForFilename = (dateString: string) => {
    const date = new Date(dateString);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  };
  
  if (loading) {
    return <LoadingSpinner fullScreen text="Loading speech feedback..." />;
  }
  
  return (
    <ErrorBoundary fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="max-w-md w-full bg-white dark:bg-gray-800 shadow-lg rounded-lg p-8">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Something went wrong</h2>
            <p className="text-gray-600 dark:text-gray-300 mb-6">
              We encountered an error while loading your speech feedback. Please try refreshing.
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
        <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
          {/* Back button and page header */}
          <div className="flex justify-between items-center mb-6">
            <button 
              onClick={() => router.back()}
              className="flex items-center text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
            >
              <ArrowLeftIcon className="h-5 w-5 mr-1" />
              Back
            </button>
            
            {/* Export button - Add this new button */}
            {feedback && (
              <button
                onClick={handleExportFeedback}
                className="btn btn-secondary btn-sm"
                title="Export feedback as Markdown"
              >
                Export Feedback
              </button>
            )}
          </div>
          
          {/* Error Message */} 
          {error && !feedback && (
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
          
          {/* Feedback Content */}
          {feedback && (
            <div className="space-y-8">
              {/* Header Section */}
              <div className="flex flex-col md:flex-row md:items-center md:justify-between pb-5 border-b border-gray-200 dark:border-gray-700">
                <div>
                  <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                    {feedback.topic || 'Speech Feedback'}
                  </h1>
                  <div className="mt-1 flex items-center text-sm text-gray-500 dark:text-gray-400 space-x-2">
                    <span>{formatSpeechType(feedback.speech_type || feedback.speech_types)}</span>
                    <span>•</span>
                    <span>{formatDate(feedback.created_at)}</span>
                  </div>
                </div>
                <button
                  onClick={() => router.push('/history')}
                  className="btn btn-secondary mt-4 md:mt-0"
                >
                  <ArrowLeftIcon className="h-4 w-4 mr-2" />
                  Back to History
                </button>
              </div>
              
              {/* Audio Player Section */}
              {feedback.audio_url && (
                <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg overflow-hidden">
                  <div className="px-4 py-5 sm:px-6">
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Audio Recording</h2>
                     <AudioPlayer audioUrl={feedback.audio_url} />
                  </div>
                </div>
              )}
              
              {/* RENDER FEEDBACK SECTIONS IN PRIORITIZED ORDER */}
              {[
                'Overall Summary',
                'Strengths',
                'Areas for Improvement',
                'Next Steps',
                'Structure & Organization',
                'Argumentation & Evidence',
                'Clarity & Conciseness',
                'Persuasiveness & Impact',
                'Delivery Style (Inferred)',
                'Strategic success Speech Type(s)'
              ].map(heading => {
                const content = parsedFeedbackSections[heading];
                if (!content) return null;
                const displayTitle = heading;
                const initialCollapsed = !['Overall Summary', 'Strengths', 'Areas for Improvement', 'Next Steps'].includes(heading);
                
                // Determine accent color based on section type (example logic)
                let accentColor = 'primary-500'; // Default
                if (['Strengths'].includes(heading)) accentColor = 'primary-500';
                if (['Areas for Improvement', 'Actionable Suggestions'].includes(heading)) accentColor = 'secondary-500';
                if (['Overall Summary', 'Next Steps'].includes(heading)) accentColor = 'primary-500'; 

                return (
                  <FeedbackSection
                    key={heading}
                    title={displayTitle}
                    content={content}
                    initialCollapsed={initialCollapsed}
                    accentColor={accentColor} // Pass the determined color
                  />
                );
              })}

              {/* Fallback or message if parsing fails or no sections found */}
              {Object.keys(parsedFeedbackSections).length === 0 && (feedback.feedback?.overall || feedback.feedback?.overallSummary) && (
                 <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg overflow-hidden">
                   <div className="px-4 py-5 sm:px-6">
                     <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Feedback Assessment</h2>
                     <div className="prose prose-sm sm:prose lg:prose-lg xl:prose-xl dark:prose-invert max-w-none">
                       <ReactMarkdown>{feedback.feedback.overall || feedback.feedback.overallSummary}</ReactMarkdown>
                     </div>
                     <p className="mt-4 text-sm text-gray-600 dark:text-gray-400">
                       Note: Could not automatically parse feedback into sections. Displaying raw content.
                     </p>
                   </div>
                 </div>
              )}

              {/* Message if no feedback content at all */}
              {!feedback.feedback?.overall && !feedback.feedback?.overallSummary && (
                <div className="bg-gray-50 dark:bg-gray-800/30 border border-gray-300 dark:border-gray-700 rounded-md p-4">
                  <p className="text-sm text-gray-700 dark:text-gray-300">Feedback is still processing or was not generated for this speech.</p>
                </div>
              )}
            </div>
          )}
          
          {/* Case where feedback object exists but no URL and no overall text */}
          {feedback && !feedback.audio_url && !feedback.feedback?.overall && !feedback.feedback?.overallSummary && (
             <div className="mt-6 bg-gray-50 dark:bg-gray-800 shadow-md rounded-lg p-6 text-center">
               <p className="text-gray-600 dark:text-gray-400">No audio recording or feedback text is available for this entry.</p>
             </div>
          )}

        </div>
      </Layout>
    </ErrorBoundary>
  );
} 