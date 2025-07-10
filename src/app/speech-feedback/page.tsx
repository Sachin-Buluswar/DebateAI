'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import ErrorBoundary from '@/components/ErrorBoundary';
import { supabase } from '@/lib/supabaseClient';
import Layout from '@/components/layout/Layout';
import type { User } from '@/types';
import { PlayIcon, PauseIcon, StopIcon, CloudArrowUpIcon, MicrophoneIcon } from '@heroicons/react/24/solid';
import { MAX_UPLOAD_SIZE_BYTES, MAX_USER_STORAGE_BYTES, UPLOAD_CHUNK_SIZE_BYTES, MAX_RECORDING_MINUTES } from '@/shared/constants';

// Import our new UI components
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardContent, CardFooter } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/utils/cn';

// Constants for storage limits and chunked uploads
const MAX_UPLOAD_SIZE_MB = MAX_UPLOAD_SIZE_BYTES / (1024 * 1024);
const MAX_RECORDING_LENGTH_MINUTES = MAX_RECORDING_MINUTES;
const MAX_USER_STORAGE_MB = MAX_USER_STORAGE_BYTES / (1024 * 1024);
const UPLOAD_CHUNK_SIZE = UPLOAD_CHUNK_SIZE_BYTES;

// Define available speech types
const availableSpeechTypes = [
  { id: 'constructive', label: 'Constructive', color: 'primary' },
  { id: 'rebuttal', label: 'Rebuttal', color: 'primary' },
  { id: 'cross-examination', label: 'Cross-Examination', color: 'secondary' },
  { id: 'summary', label: 'Summary', color: 'secondary' },
  { id: 'final-focus', label: 'Final Focus', color: 'primary' }
];

export default function SpeechFeedback() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  const [topic, setTopic] = useState('');
  const [selectedSpeechTypes, setSelectedSpeechTypes] = useState<string[]>([]);
  const [userSide, setUserSide] = useState<string>('None'); // 'Proposition', 'Opposition', 'None'
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [customInstructions, setCustomInstructions] = useState('');
  
  // Storage usage tracking
  const [storageUsed, setStorageUsed] = useState(0); // in bytes
  const [storageUsageLoading, setStorageUsageLoading] = useState(false);
  
  // Recording states
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  
  // Refs for recording
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewAudioRef = useRef<HTMLAudioElement>(null);
  const [previewPlaying, setPreviewPlaying] = useState(false);
  const [previewCurrentTime, setPreviewCurrentTime] = useState(0);
  const [previewDuration, setPreviewDuration] = useState(0);
  
  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop(); // onstop handler will process the blob
      setIsRecording(false);
      
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  }, []);
  
  const isStorageLimitReached = useCallback(() => {
    const currentBytes = storageUsed;
    const maxBytes = MAX_USER_STORAGE_MB * 1024 * 1024;
    return currentBytes >= maxBytes;
  }, [storageUsed]);

  const startRecording = useCallback(async () => {
    try {
      // Check if user has reached storage limit
      if (isStorageLimitReached()) {
        setError(`You've reached your storage limit of ${MAX_USER_STORAGE_MB}MB. Please delete some recordings before adding more.`);
        return;
      }
      
      // Enhanced browser compatibility check for audio recording
      if (!navigator.mediaDevices) {
        setError('Audio recording is not supported in your browser. Please try using Chrome, Firefox, or Safari, or upload an audio file instead.');
        return;
      }
      
      // Check specifically for getUserMedia support
      if (!navigator.mediaDevices.getUserMedia) {
        setError('Audio recording requires microphone access which is not available in your browser. Please use a modern browser or upload an audio file instead.');
        return;
      }
      
      // Check for MediaRecorder API support
      if (!window.MediaRecorder) {
        setError('Your browser does not support the MediaRecorder API needed for audio recording. Please use Chrome, Firefox, Safari, or upload a pre-recorded file.');
        return;
      }
      
      // Reset any previous recordings/uploads
      audioChunksRef.current = [];
      setAudioBlob(null);
      setUploadedFile(null);
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
      setRecordingTime(0);
      setPreviewCurrentTime(0);
      setPreviewDuration(0);
      setPreviewPlaying(false);
      setError(null);
      setSuccess(null);
      
      // Request microphone permission and get stream
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch (micError: unknown) {
        const error = micError instanceof Error ? micError as DOMException : new Error('An unknown error occurred');
        if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
          throw new Error('Microphone access denied. Please grant permission in your browser settings.');
        } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
          throw new Error('No microphone detected. Please connect a microphone and try again.');
        } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
          throw new Error('Your microphone is busy or unavailable. Please close other applications that might be using it.');
        } else {
          throw error;
        }
      }
      
      // Try different audio formats based on browser support
      let options = {};
      const mimeTypes = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/ogg;codecs=opus',
        'audio/ogg',
        'audio/mp4',
        'audio/mpeg'
      ];
      
      for (const mimeType of mimeTypes) {
        if (MediaRecorder.isTypeSupported(mimeType)) {
          options = { mimeType };
          console.log(`Using supported MIME type: ${mimeType}`);
          break;
        }
      }

      // Create media recorder
      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;
      
      // Set up event handlers
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };
      
      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: mediaRecorder.mimeType });
        
        // Check if the recording time exceeds the maximum allowed
        if (recordingTime > MAX_RECORDING_LENGTH_MINUTES * 60) {
          setError(`Recording exceeds the maximum allowed length of ${MAX_RECORDING_LENGTH_MINUTES} minutes.`);
          // Still create the URL so the user can listen
          const url = URL.createObjectURL(blob);
          setAudioUrl(url);
          setAudioBlob(blob); // Set the blob even if too long
          return;
        }
        
        const url = URL.createObjectURL(blob);
        setAudioBlob(blob);
        setAudioUrl(url);
        
        // Stop all tracks in the stream
        stream.getTracks().forEach(track => track.stop());
      };
      
      // Start recording
      mediaRecorder.start(1000); // Collect 1-second chunks
      setIsRecording(true);
      
      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => {
          if (prev + 1 > MAX_RECORDING_LENGTH_MINUTES * 60) {
            stopRecording(); // Auto-stop if max length reached
            return prev;
          }
          return prev + 1;
        });
      }, 1000);
      
    } catch (err) {
      const error = err instanceof Error ? err : new Error('An unknown error occurred');
      console.error('Error starting recording:', err);
      if (error instanceof DOMException && error.name === 'NotAllowedError') {
          setError('Microphone access denied. Please grant permission in your browser settings.');
      } else {
          setError('Failed to access microphone. Please check permissions and ensure it is connected.');
      }
    }
  }, [audioUrl, isStorageLimitReached, recordingTime, stopRecording]);

  const fetchStorageUsage = useCallback(async (userId: string) => {
    try {
      setStorageUsageLoading(true);
      
      // Fetch from speech_feedback table to calculate total storage
      const { data, error: fetchError } = await supabase
        .from('speech_feedback')
        .select('file_size_bytes')
        .eq('user_id', userId);
      
      if (fetchError) {
        console.error('Error fetching storage usage:', fetchError);
        return;
      }
      
      // Sum up file sizes
      const totalBytes = data?.reduce((sum, item) => sum + (item.file_size_bytes || 0), 0) || 0;
      setStorageUsed(totalBytes);
    } catch (err) {
      console.error('Error calculating storage usage:', err);
    } finally {
      setStorageUsageLoading(false);
    }
  }, []);

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
        
        // Fetch user's storage usage
        fetchStorageUsage(data.session.user.id);
      } catch (err) {
        console.error('Error checking user session:', err);
        setError('Failed to authenticate user. Please try logging in again.');
        router.push('/auth');
      }
    };
    
    checkUser();
    
    // Clean up recorder on unmount
    return () => {
      stopRecording();
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [router, fetchStorageUsage, stopRecording, audioUrl]);
  
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
    const secs = Math.floor(seconds % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
  };
  
  const getStorageUsagePercent = () => {
    if (MAX_USER_STORAGE_MB <= 0) return 0; // Avoid division by zero
    const maxBytes = MAX_USER_STORAGE_MB * 1024 * 1024;
    return Math.min(Math.round((storageUsed / maxBytes) * 100), 100);
  };
  
  const formatStorageSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };
  
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      setError(null);
      setSuccess(null);
      
      // Check if user has reached storage limit
      if (isStorageLimitReached()) {
        setError(`You've reached your storage limit of ${MAX_USER_STORAGE_MB}MB. Please delete some recordings before adding more.`);
        e.target.value = ''; // Reset file input
        return;
      }
      
      // Validate file type
      const validTypes = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/webm', 'audio/aac', 'audio/flac', 'audio/m4a', 'audio/x-m4a'];
      if (!validTypes.includes(file.type)) {
        setError(`Invalid file type (${file.type}). Please upload MP3, WAV, OGG, WEBM, AAC, FLAC or M4A.`);
        e.target.value = ''; // Reset file input
        return;
      }
      
      // Validate file size (25MB limit)
      const MAX_SIZE = MAX_UPLOAD_SIZE_MB * 1024 * 1024; // 25MB in bytes
      if (file.size > MAX_SIZE) {
        setError(`File too large (${(file.size / (1024*1024)).toFixed(1)}MB). Max size: ${MAX_UPLOAD_SIZE_MB}MB.`);
        e.target.value = ''; // Reset file input
        return;
      }
      
      // Clear any previous recordings
      setAudioBlob(null);
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
      setRecordingTime(0);
      setPreviewCurrentTime(0);
      setPreviewDuration(0);
      setPreviewPlaying(false);
      
      // Set the uploaded file
      setUploadedFile(file);
      const url = URL.createObjectURL(file);
      setAudioUrl(url);
      
      // Reset file input value to allow re-uploading same file
      e.target.value = ''; 
    }
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!topic.trim()) {
      setError('Please enter a speech topic');
      return;
    }
    
    if (!audioBlob && !uploadedFile) {
      setError('Please record or upload your speech audio');
      return;
    }
    
    if (selectedSpeechTypes.length === 0) {
      setError('Please select at least one speech type.');
      return;
    }
    
    // Check if user has reached storage limit BEFORE trying to submit
    const audioFile = audioBlob ? new File([audioBlob], 'speech.webm', { type: audioBlob.type }) : uploadedFile;
    if (!audioFile) {
      setError('Could not find audio data.');
      return;
    }
    const projectedUsage = storageUsed + audioFile.size;
    if (projectedUsage > MAX_USER_STORAGE_MB * 1024 * 1024) {
      setError(`Uploading this file would exceed your storage limit of ${MAX_USER_STORAGE_MB}MB. Please delete older recordings.`);
      return;
    }
    
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    
    try {
      // First check if speech_feedback table exists
      const { error: tableCheckError } = await supabase
        .from('speech_feedback')
        .select('id')
        .limit(1);
        
      if (tableCheckError && tableCheckError.code === '42P01') {
        // Table doesn't exist - this is now handled by the backend
        console.warn('Speech feedback table does not exist yet, will be created by backend');
      }
      
      // Validate selections again
      if (selectedSpeechTypes.length === 0) {
        throw new Error('Please select at least one speech type.');
      }
      
      // Use streaming upload with chunks to prevent memory issues
      let response;
      
      try {
        if (audioFile.size > UPLOAD_CHUNK_SIZE) {
          // For large files, use chunked upload
          setSuccess('Starting chunked upload...');
          response = await uploadLargeFile(audioFile);
        } else {
          // For small files, use regular upload
          setSuccess('Uploading audio file...');
          const formData = new FormData();
          formData.append('audio', audioFile);
          formData.append('topic', topic);
          formData.append('speechTypes', JSON.stringify(selectedSpeechTypes));
          formData.append('userSide', userSide);
          formData.append('customInstructions', customInstructions);
          formData.append('userId', user?.id || '');
          
          response = await fetch('/api/speech-feedback', {
            method: 'POST',
            body: formData,
          });
        }
      } catch (uploadError: unknown) {
        const error = uploadError instanceof Error ? uploadError : new Error('An unknown error occurred');
        console.error('Upload error:', uploadError);
        // Provide specific error message based on the error type
        if (error.message?.includes('network') || error.message?.includes('connection')) {
          throw new Error('Network error during upload. Please check your internet connection and try again.');
        } else if (error.message?.includes('aborted') || error.message?.includes('timeout')) {
          throw new Error('Upload timed out. Your file might be too large or your connection too slow.');
        } else {
          throw new Error(`Upload failed: ${error.message || 'Unknown error'}`);
        }
      }
      
      // Check if response was successful
      if (!response.ok) {
        let errorData;
        try {
          errorData = await response.json();
        } catch {
          // If we can't parse the error response, provide a generic error
          throw new Error(`Request failed with status: ${response.status}`);
        }
        
        // Provide specific error message based on status code and error details
        if (response.status === 413) {
          throw new Error('File too large. Please upload a smaller audio file.');
        } else if (response.status === 401 || response.status === 403) {
          throw new Error('Authentication error. Please try signing out and back in.');
        } else if (errorData?.warning) {
          // Handle warnings that might be returned from the API
          setSuccess(`Feedback generated successfully. ${errorData.warning}`);
          const feedbackId = errorData.id || 'unknown';
          router.push(`/speech-feedback/${feedbackId}`);
          return;
        } else {
          throw new Error(errorData?.error || errorData?.details || 'Failed to generate feedback. Please try again.');
        }
      }
      
      const result = await response.json();
      
      if (result.id) {
        // Success - redirect to the feedback page
        setSuccess('Feedback generated successfully!');
        router.push(`/speech-feedback/${result.id}`);
      } else {
        // Handle unexpected result format
        console.error('Unexpected response format:', result);
        throw new Error('Received invalid response from server. Please try again.');
      }
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error('An unknown error occurred');
      console.error('Error submitting speech:', error);
      setError(error?.message || 'An unexpected error occurred. Please try again.');
      // Reset submitting state to allow retry
      setSubmitting(false);
    }
  };

  const uploadLargeFile = async (file: File): Promise<Response> => {
    // Create a new session ID for this upload
    const sessionId = Date.now().toString();
    const totalChunks = Math.ceil(file.size / UPLOAD_CHUNK_SIZE);
    
    // Show progress info in the success state (repurposing it during upload)
    setSuccess(`Preparing upload...`);
    
    // Use a counter to track uploaded chunks
    let uploadedChunks = 0;
    
    try {
      // Create initial headers to start the session
      const initResponse = await fetch('/api/speech-feedback/init', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          filename: file.name,
          contentType: file.type,
          totalSize: file.size,
          totalChunks: totalChunks,
          sessionId: sessionId,
          topic: topic,
          speechTypes: selectedSpeechTypes,
          userSide: userSide,
          customInstructions: customInstructions,
          userId: user?.id || '',
        }),
      });
      
      if (!initResponse.ok) {
        const errorData = await initResponse.json();
        throw new Error(errorData.error || 'Failed to initialize chunked upload');
      }
      
      // Upload each chunk using more optimized memory handling
      for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
        const start = chunkIndex * UPLOAD_CHUNK_SIZE;
        const end = Math.min(start + UPLOAD_CHUNK_SIZE, file.size);
        
        // Create a slice of the file for this chunk
        // This doesn't load the entire file into memory
        const chunk = file.slice(start, end);
        
        // Update progress
        uploadedChunks++;
        const percentComplete = Math.round((uploadedChunks / totalChunks) * 100);
        setSuccess(`Uploading... ${percentComplete}%`);
        
        // Create a fresh FormData for each chunk to avoid memory leaks
        const formData = new FormData();
        formData.append('chunk', chunk);
        formData.append('sessionId', sessionId);
        formData.append('chunkIndex', chunkIndex.toString());
        formData.append('finalChunk', (chunkIndex === totalChunks - 1).toString());
        
        // Upload this chunk
        const chunkResponse = await fetch('/api/speech-feedback/chunk', {
          method: 'POST',
          body: formData,
        });
        
        if (!chunkResponse.ok) {
          const errorData = await chunkResponse.json();
          throw new Error(errorData.error || `Failed to upload chunk ${chunkIndex + 1}`);
        }
        
        // If we're on the last chunk, finalize the upload
        if (chunkIndex === totalChunks - 1) {
          setSuccess(`Processing upload...`);
          
          // Add topic, speechTypes, userSide, customInstructions, userId to finalize call body
          const finalizeBody = JSON.stringify({
            sessionId: sessionId,
            topic: topic,
            speechTypes: selectedSpeechTypes,
            userSide: userSide,
            customInstructions: customInstructions,
            userId: user?.id || '',
          });
          
          const finalizeResponse = await fetch('/api/speech-feedback/finalize', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: finalizeBody,
          });
          
          return finalizeResponse;
        }
        
        // Help browser with garbage collection between chunks
        // Don't assign null to chunk as it's a const - instead use setTimeout
        // to encourage the garbage collector to run
        await new Promise(resolve => setTimeout(resolve, 0));
      }
      
      // This should not be reached if the chunking works correctly
      throw new Error('Unexpected error: Failed to complete all chunks');
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error('An unknown error occurred');
      console.error('Error in chunked upload:', error);
      // Clean up any partial upload
      try {
        await fetch(`/api/speech-feedback/cancel?sessionId=${sessionId}`, {
          method: 'DELETE',
        });
      } catch (cleanupError) {
        console.error('Failed to clean up partial upload:', cleanupError);
      }
      throw error;
    }
  };
  
  const handleSpeechTypeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { value, checked } = event.target;
    setSelectedSpeechTypes(prev => 
      checked ? [...prev, value] : prev.filter(type => type !== value)
    );
  };

  // --- Audio Preview Player Logic ---
  const handlePreviewPlayPause = () => {
    if (!previewAudioRef.current) return;
    if (previewPlaying) {
      previewAudioRef.current.pause();
    } else {
      previewAudioRef.current.play();
    }
    setPreviewPlaying(!previewPlaying);
  };

  const handlePreviewTimeUpdate = () => {
    if (!previewAudioRef.current) return;
    setPreviewCurrentTime(previewAudioRef.current.currentTime);
  };

  const handlePreviewLoadedMetadata = () => {
    if (!previewAudioRef.current) return;
    setPreviewDuration(previewAudioRef.current.duration);
  };
  
  const handlePreviewSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!previewAudioRef.current) return;
    const newTime = parseFloat(e.target.value);
    previewAudioRef.current.currentTime = newTime;
    setPreviewCurrentTime(newTime);
  };
  
  const handlePreviewEnded = () => {
    setPreviewPlaying(false);
    setPreviewCurrentTime(0);
    // Reset requires the ref to be valid
    if (previewAudioRef.current) { 
        previewAudioRef.current.currentTime = 0; 
    } 
  };
  // --- End Audio Preview Player Logic ---

  const renderUploadForm = () => {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in">
        {/* Main Form Section */}
        <div className="lg:col-span-2">
          <Card variant="gradient" className="overflow-hidden">
            <form onSubmit={handleSubmit}>
              <CardHeader size="lg">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-primary-100 dark:bg-primary-900/30 rounded-lg">
                    <MicrophoneIcon className="w-6 h-6 text-primary-600 dark:text-primary-400" />
                  </div>
                  <div>
                    <h2>Speech Details</h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      Provide details about your speech and upload or record the audio.
                    </p>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-6">
                {/* Topic Input */}
                <Input
                  id="topic"
                  label="Debate Topic / Speech Title"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="e.g., Abolishing the Electoral College"
                  required
                />

                {/* Speech Type Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                    Speech Type(s) <span className="text-red-500">*</span>
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {availableSpeechTypes.map((type) => (
                      <label
                        key={type.id}
                        className={cn(
                          "relative flex items-center px-4 py-2 rounded-lg border-2 cursor-pointer transition-all",
                          selectedSpeechTypes.includes(type.id)
                            ? "border-primary-500 bg-primary-50 dark:bg-primary-900/20"
                            : "border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500"
                        )}
                      >
                        <input
                          type="checkbox"
                          value={type.id}
                          checked={selectedSpeechTypes.includes(type.id)}
                          onChange={handleSpeechTypeChange}
                          className="sr-only"
                        />
                        <Badge 
                          variant={selectedSpeechTypes.includes(type.id) ? type.color as 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info' | 'outline' : 'secondary'}
                          size="md"
                        >
                          {type.label}
                        </Badge>
                      </label>
                    ))}
                  </div>
                </div>

                {/* User Side Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                    Your Side (Optional)
                  </label>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { value: 'Proposition', label: 'Proposition / Aff', icon: '👍' },
                      { value: 'Opposition', label: 'Opposition / Neg', icon: '👎' },
                      { value: 'None', label: 'None / N/A', icon: '🤷' }
                    ].map((side) => (
                      <label
                        key={side.value}
                        className={cn(
                          "relative flex flex-col items-center p-4 rounded-lg border-2 cursor-pointer transition-all",
                          userSide === side.value
                            ? "border-primary-500 bg-primary-50 dark:bg-primary-900/20"
                            : "border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500"
                        )}
                      >
                        <input
                          type="radio"
                          name="userSide"
                          value={side.value}
                          checked={userSide === side.value}
                          onChange={(e) => setUserSide(e.target.value)}
                          className="sr-only"
                        />
                        <span className="text-2xl mb-2">{side.icon}</span>
                        <span className="text-sm font-medium text-center">{side.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Custom Instructions */}
                <Textarea
                  id="customInstructions"
                  label="Custom Instructions (Optional)"
                  value={customInstructions}
                  onChange={(e) => setCustomInstructions(e.target.value)}
                  placeholder="e.g., Focus on my pacing and tone..."
                  helperText="Tell the AI specific areas you want feedback on."
                  rows={3}
                />

                {/* Storage Usage */}
                <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Storage Usage
                    </span>
                    <Badge 
                      variant={getStorageUsagePercent() >= 90 ? 'error' : getStorageUsagePercent() >= 70 ? 'warning' : 'success'}
                      size="sm"
                    >
                      {getStorageUsagePercent()}%
                    </Badge>
                  </div>
                  {storageUsageLoading ? (
                    <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse" />
                  ) : (
                    <div className="relative">
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                        <div 
                          className={cn(
                            "h-full rounded-full transition-all duration-500 ease-out",
                            getStorageUsagePercent() >= 90 ? 'bg-error-500' : 
                            getStorageUsagePercent() >= 70 ? 'bg-warning-400' : 'bg-success-500'
                          )}
                          style={{ width: `${getStorageUsagePercent()}%` }}
                        />
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {formatStorageSize(storageUsed)} of {MAX_USER_STORAGE_MB}MB used
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>

              <CardFooter>
                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  fullWidth
                  disabled={submitting || (!audioBlob && !uploadedFile) || !topic.trim() || selectedSpeechTypes.length === 0}
                  isLoading={submitting}
                  loadingText="Generating feedback..."
                  leftIcon={submitting ? undefined : <CloudArrowUpIcon className="w-5 h-5" />}
                >
                  Submit for Feedback
                </Button>
              </CardFooter>
            </form>
          </Card>
        </div>

        {/* Audio Upload Section */}
        <div className="lg:col-span-1">
          <Card variant="glass" className="sticky top-20">
            <CardHeader>
              <h3 className="flex items-center gap-2">
                <span className="text-2xl">🎙️</span>
                Audio Upload
              </h3>
            </CardHeader>
            
            <CardContent className="space-y-4">
              {/* Upload Options */}
              <div className="space-y-3">
                <input
                  type="file"
                  accept="audio/mpeg, audio/mp3, audio/wav, audio/ogg, audio/webm, audio/aac, audio/flac, audio/m4a, audio/x-m4a"
                  onChange={handleFileUpload}
                  className="hidden" 
                  ref={fileInputRef}
                  disabled={isRecording || submitting}
                />
                
                <Button
                  variant="secondary"
                  fullWidth
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isRecording || submitting}
                  leftIcon={<CloudArrowUpIcon className="w-5 h-5" />}
                >
                  Upload Audio File
                </Button>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-300 dark:border-gray-600"></div>
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-2 bg-white dark:bg-gray-800 text-gray-500">OR</span>
                  </div>
                </div>

                {!isRecording ? (
                  <Button
                    variant="accent"
                    fullWidth
                    onClick={startRecording}
                    disabled={submitting}
                    leftIcon={<MicrophoneIcon className="w-5 h-5" />}
                  >
                    Start Recording
                  </Button>
                ) : (
                  <div className="bg-error-50 dark:bg-error-900/20 border-2 border-error-300 dark:border-error-700 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-error-500 rounded-full animate-pulse" />
                        <span className="text-sm font-medium text-error-700 dark:text-error-300">
                          Recording...
                        </span>
                      </div>
                      <span className="font-mono text-lg text-error-700 dark:text-error-300">
                        {formatTime(recordingTime)}
                      </span>
                    </div>
                    <Button
                      variant="danger"
                      fullWidth
                      size="sm"
                      onClick={stopRecording}
                      leftIcon={<StopIcon className="w-4 h-4" />}
                    >
                      Stop Recording
                    </Button>
                  </div>
                )}
              </div>

              <div className="text-center text-xs text-gray-500 dark:text-gray-400 space-y-1">
                <p>Max file size: {MAX_UPLOAD_SIZE_MB}MB</p>
                <p>Max recording: {MAX_RECORDING_LENGTH_MINUTES} minutes</p>
              </div>

              {/* Audio Preview */}
              {audioUrl && (
                <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                    Audio Preview
                  </h4>
                  <audio 
                    ref={previewAudioRef}
                    src={audioUrl} 
                    className="hidden"
                    onTimeUpdate={handlePreviewTimeUpdate}
                    onLoadedMetadata={handlePreviewLoadedMetadata}
                    onEnded={handlePreviewEnded}
                  />
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <Button
                        variant="primary"
                        size="icon"
                        onClick={handlePreviewPlayPause}
                      >
                        {previewPlaying ? <PauseIcon className="h-4 w-4" /> : <PlayIcon className="h-4 w-4" />}
                      </Button>
                      <div className="flex-1">
                        <input 
                          type="range" 
                          min="0" 
                          max={previewDuration || 0}
                          step="0.1"
                          value={previewCurrentTime} 
                          onChange={handlePreviewSeek}
                          className="w-full h-2 bg-gray-200 dark:bg-gray-600 rounded-lg appearance-none cursor-pointer accent-primary-600"
                        />
                      </div>
                    </div>
                    <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                      <span>{formatTime(previewCurrentTime)}</span>
                      <span>{formatTime(previewDuration)}</span>
                    </div>
                    <p className="text-xs text-gray-600 dark:text-gray-400 truncate">
                      {uploadedFile ? uploadedFile.name : 'Recorded Audio'}
                      {' '}({formatStorageSize((audioBlob || uploadedFile)?.size || 0)})
                    </p>
                  </div>
                </div>
              )}

              {/* Alert Messages */}
              {error && (
                <div className="alert alert-error">
                  <p className="text-sm font-medium">Error</p>
                  <p className="text-xs mt-1">{error}</p>
                </div>
              )}
              {success && (
                <div className="alert alert-success">
                  <p className="text-sm font-medium">Success</p>
                  <p className="text-xs mt-1">{success}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  };

  return (
    <ErrorBoundary fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="max-w-md w-full bg-white dark:bg-gray-800 shadow-lg rounded-lg p-8">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Something went wrong</h2>
            <p className="text-gray-600 dark:text-gray-300 mb-6">
              We encountered an error in the speech feedback page. Please try refreshing.
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
          {loading ? (
            <div className="flex justify-center items-center h-60">
               <LoadingSpinner text="Loading speech practice area..." />
            </div>
          ) : user ? (
            <> 
             {/* Page Header */}
             <div className="pb-5 border-b border-gray-200 dark:border-gray-700 mb-8">
               <h1>
                 Speech Practice
               </h1>
               <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                 Upload or record audio for AI-powered feedback on your delivery and arguments.
               </p>
             </div>
             {renderUploadForm()} 
            </> 
          ) : (
             <div className="text-center py-10">
              <p className="text-lg text-red-600">Please sign in to use the Speech Feedback tool.</p>
              {/* Optionally add a sign-in button here */}
             </div>
          )}
        </div>
      </Layout>
    </ErrorBoundary>
  );
} 