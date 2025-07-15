'use client';

import { useEffect, useState, useRef, FormEvent, useMemo, useCallback, memo } from 'react';
import { io, Socket } from 'socket.io-client';
import {
  Participant,
  DebateState,
} from '@/backend/modules/realtimeDebate/debate-types';
import { debateConfig } from '@/backend/modules/realtimeDebate/debate.config';
import dynamic from 'next/dynamic';
import { Suspense } from 'react';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import Layout from '@/components/layout/Layout';

// Lazy load heavy components for better initial load performance
const ParticipantPanel = dynamic(() => import('../../components/debate/ParticipantPanel'), {
  loading: () => <LoadingSpinner text="Loading participants..." />,
  ssr: false,
});

const WikiSearchPanel = dynamic(() => import('@/components/debate/WikiSearchPanel').then(mod => ({ default: mod.WikiSearchPanel })), {
  loading: () => <LoadingSpinner text="Loading research panel..." />,
  ssr: false,
});

const StreamingAudioPlayer = dynamic(() => import('../../components/debate/StreamingAudioPlayer'), {
  loading: () => <LoadingSpinner text="Loading audio player..." />,
  ssr: false,
});

const AudioRecorder = dynamic(() => import('../../components/debate/AudioRecorder'), {
  loading: () => <LoadingSpinner text="Loading recorder..." />,
  ssr: false,
});

const CrossfireController = dynamic(() => import('../../components/debate/CrossfireControls'), {
  loading: () => <LoadingSpinner text="Loading controls..." />,
  ssr: false,
});
import { Card, CardHeader, CardContent } from '@/components/ui/Card';
import EnhancedButton from '@/components/ui/EnhancedButton';
import EnhancedInput from '@/components/ui/EnhancedInput';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { PlayIcon, PauseIcon, ForwardIcon, BookmarkIcon, CheckIcon } from '@heroicons/react/24/outline';
import { supabase } from '@/lib/supabaseClient';

type DebateSetup = {
  topic: string;
  side: 'PRO' | 'CON';
  aiPartner: boolean;
  selectedAIDebaters: string[]; // Array of 3 selected AI debater names
};

// Create participants function outside component for performance
const createParticipants = (setup: DebateSetup): Participant[] => {
  const participants: Participant[] = [];
  
  // Use selected AI debaters, fallback to default if not enough selected
  const defaultAI = ['Emily Carter', 'Marcus Johnson', 'Sophia Chen'];
  const selectedAI = setup.selectedAIDebaters.length >= 3 ? setup.selectedAIDebaters : defaultAI;
  
  if (setup.side === 'PRO') {
    participants.push({ id: 'human-pro-1', name: 'You', isAI: false, team: 'PRO', role: 'SPEAKER_1' });
    if (setup.aiPartner) {
      participants.push({ id: 'ai-pro-2', name: selectedAI[0], isAI: true, team: 'PRO', role: 'SPEAKER_2' });
    }
    participants.push({ id: 'ai-con-1', name: selectedAI[1], isAI: true, team: 'CON', role: 'SPEAKER_1' });
    participants.push({ id: 'ai-con-2', name: selectedAI[2], isAI: true, team: 'CON', role: 'SPEAKER_2' });
  } else {
    participants.push({ id: 'human-con-1', name: 'You', isAI: false, team: 'CON', role: 'SPEAKER_1' });
    if (setup.aiPartner) {
      participants.push({ id: 'ai-con-2', name: selectedAI[0], isAI: true, team: 'CON', role: 'SPEAKER_2' });
    }
    participants.push({ id: 'ai-pro-1', name: selectedAI[1], isAI: true, team: 'PRO', role: 'SPEAKER_1' });
    participants.push({ id: 'ai-pro-2', name: selectedAI[2], isAI: true, team: 'PRO', role: 'SPEAKER_2' });
  }
  return participants;
};

export default function DebatePage() {
  const [debateState, setDebateState] = useState<DebateState | null>(null);
  const [currentSpeaker, setCurrentSpeaker] = useState<string>('');
  const [isResearchPanelVisible, setIsResearchPanelVisible] = useState(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [reconnectAttempt, setReconnectAttempt] = useState(0);
  const [audioQueue, setAudioQueue] = useState<Blob[]>([]);
  const [isCrossfireActive, setIsCrossfireActive] = useState<boolean>(false);
  const socketRef = useRef<Socket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [setup, setSetup] = useState<DebateSetup | null>(null);
  const [speechText, setSpeechText] = useState<string>('');
  const [formData, setFormData] = useState({ 
    topic: '', 
    side: 'PRO' as 'PRO' | 'CON', 
    aiPartner: false, 
    selectedAIDebaters: [] as string[] 
  });
  const [debateAnalysis, setDebateAnalysis] = useState<{
    overallScore: number;
    overallPerformance: number;
    categories: Record<string, { score: number; feedback: string }>;
    argumentQuality: { score: number; feedback: string };
    deliveryClarity: { score: number; feedback: string };
    evidenceUsage: { score: number; feedback: string };
    rebuttalEffectiveness: { score: number; feedback: string };
    detailedFeedback: string;
    suggestions: string[];
    strengthsAreas: string[];
    improvementAreas: string[];
    keyMoments: Array<{ timestamp: string; moment: string }>;
    recommendedNextSteps: string[];
  } | null>(null);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  // Memoize available AI debaters to avoid recreating array on each render
  const availableAIDebaters = useMemo(() => Object.values(debateConfig.personalities), []);

  // Memoize participants array to avoid recreating on each render
  const participants = useMemo(() => {
    return setup ? createParticipants(setup) : [];
  }, [setup]);

  const handleAIDebaterToggle = useCallback((debaterName: string) => {
    setFormData(prev => {
      const currentSelected = prev.selectedAIDebaters;
      if (currentSelected.includes(debaterName)) {
        // Remove if already selected
        return {
          ...prev,
          selectedAIDebaters: currentSelected.filter(name => name !== debaterName)
        };
      } else if (currentSelected.length < 3) {
        // Add if less than 3 selected
        return {
          ...prev,
          selectedAIDebaters: [...currentSelected, debaterName]
        };
      }
      // If already 3 selected, don't add more
      return prev;
    });
  }, []);

  const handleSetupSubmit = useCallback((e: FormEvent) => {
    e.preventDefault();
    const topic = formData.topic?.trim();
    if (!topic) {
      alert('Please enter a debate topic');
      return;
    }
    if (formData.selectedAIDebaters.length < 3) {
      alert('Please select exactly 3 AI debaters');
      return;
    }
    setSetup({ topic, side: formData.side, aiPartner: formData.aiPartner, selectedAIDebaters: formData.selectedAIDebaters });
  }, [formData]);

  const startDebate = useCallback(() => {
    if (!setup) return;
    if (!isConnected) {
      alert('Not connected to server. Please refresh the page.');
      return;
    }
    console.log('Starting debate with participants:', participants);
    socketRef.current?.emit('startDebate', { topic: setup.topic, participants });
  }, [setup, isConnected, participants]);
  
  const handleUserSpeech = useCallback((text: string) => {
    console.log('User speech transcribed:', text);
    setCurrentSpeaker('You');
    
    const userSpeakerId = setup?.side === 'PRO' ? 'human-pro-1' : 'human-con-1';
    if (socketRef.current && debateState?.currentSpeakerId === userSpeakerId) {
      socketRef.current.emit('userSpeech', { 
        text, 
        speakerId: userSpeakerId,
        phase: debateState?.phase 
      });
    }
  }, [setup, debateState]);

  const skipUserTurn = useCallback(() => {
    const userSpeakerId = setup?.side === 'PRO' ? 'human-pro-1' : 'human-con-1';
    if (socketRef.current && debateState?.currentSpeakerId === userSpeakerId) {
      const mockSpeech = `Thank you for this opportunity. I believe my fellow debater has already made our key points well, and I yield the remainder of my time.`;
      handleUserSpeech(mockSpeech);
    }
  }, [setup, debateState, handleUserSpeech]);

  const getPhaseDisplayName = useCallback((phase: string) => {
    return phase.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }, []);

  const getTotalPhases = useCallback(() => 11, []);
  const getCurrentPhaseIndex = useCallback(() => {
    const phases = ['PRO_CONSTRUCTIVE', 'CON_CONSTRUCTIVE', 'CROSSFIRE_1', 'PRO_REBUTTAL', 'CON_REBUTTAL', 'CROSSFIRE_2', 'PRO_SUMMARY', 'CON_SUMMARY', 'GRAND_CROSSFIRE', 'PRO_FINAL_FOCUS', 'CON_FINAL_FOCUS'];
    return phases.indexOf(debateState?.phase || '') + 1;
  }, [debateState?.phase]);

  const pauseDebate = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.emit('pauseDebate');
      setIsPaused(true);
    }
  }, []);

  const resumeDebate = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.emit('resumeDebate');
      setIsPaused(false);
    }
  }, []);

  useEffect(() => {
    // Initialize socket with authentication
    const initializeSocket = async () => {
      // Get the current session
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error || !session) {
        console.error('No authenticated session found');
        setConnectionError('You must be logged in to participate in debates');
        setIsConnecting(false);
        return;
      }
      
      // This fetch call is necessary to initialize the socket.io server on the backend.
      try {
        setIsConnecting(true);
        setConnectionError(null);
        
        await fetch('/api/socketio');
      } catch (error) {
        console.error('Failed to initialize socket server:', error);
        setConnectionError('Failed to connect to debate server. Please try again.');
        setIsConnecting(false);
        return;
      }

      const socket: Socket = io({
        path: '/api/socketio',
        auth: {
          token: session.access_token
        },
        // Reconnection options
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        timeout: 20000,
        transports: ['websocket', 'polling']
      });
      
      socketRef.current = socket;

    socket.on('connect', () => {
      console.log('Socket connected successfully');
      setIsConnected(true);
      setIsConnecting(false);
      setConnectionError(null);
      setReconnectAttempt(0);
    });
    
    socket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
      setIsConnected(false);
      
      // Handle different disconnect reasons
      if (reason === 'io server disconnect') {
        setConnectionError('Disconnected by server. Attempting to reconnect...');
        socket.connect();
      } else if (reason === 'transport close' || reason === 'transport error') {
        setConnectionError('Connection lost. Attempting to reconnect...');
      } else if (reason === 'ping timeout') {
        setConnectionError('Connection timeout. Check your internet connection.');
      }
    });
    
    socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error.message);
      setIsConnected(false);
      setIsConnecting(false);
      
      // Provide user-friendly error messages
      if (error.message.includes('Authentication')) {
        setConnectionError('Authentication failed. Please log in again.');
      } else if (error.message.includes('timeout')) {
        setConnectionError('Connection timeout. Please check your internet connection.');
      } else {
        setConnectionError(`Connection failed: ${error.message}`);
      }
    });
    
    socket.on('reconnect', (attemptNumber) => {
      console.log('Socket reconnected after', attemptNumber, 'attempts');
      setIsConnected(true);
      setConnectionError(null);
      setReconnectAttempt(0);
      
      // Re-join debate if one was in progress
      if (debateState && debateState.phase !== 'ENDED') {
        // Optionally emit a rejoin event if the server supports it
        // socket.emit('rejoinDebate', { debateId: debateState.id });
      }
    });
    
    socket.on('reconnect_attempt', (attemptNumber) => {
      console.log('Socket reconnection attempt', attemptNumber);
      setReconnectAttempt(attemptNumber);
      setConnectionError(`Reconnecting... (Attempt ${attemptNumber}/5)`);
    });
    
    socket.on('reconnect_failed', () => {
      console.error('Socket reconnection failed');
      setIsConnected(false);
      setConnectionError('Failed to reconnect. Please refresh the page to try again.');
      
      // Offer manual reconnection after a delay
      reconnectTimeoutRef.current = setTimeout(() => {
        setConnectionError('Connection lost. Click "Reconnect" to try again.');
      }, 2000);
    });

    socket.on('debateStateUpdate', (newState: DebateState, mode: string) => {
      setDebateState(newState);
      if (mode === 'crossfire') {
        setIsCrossfireActive(true);
        setCurrentSpeaker('Crossfire');
      }
      // Do not reset isCrossfireActive flag on timer updates to avoid flicker
      if (mode === 'speech') {
        setIsCrossfireActive(false);
        // Find and set current speaker name
        if (setup && newState.currentSpeakerId && newState.currentSpeakerId !== 'CROSSFIRE') {
          const speaker = participants.find(p => p.id === newState.currentSpeakerId);
          if (speaker) {
            setCurrentSpeaker(speaker.name);
          }
        }
      }
    });

    socket.on('debateAnalysis', (analysis: {
      overallScore: number;
      overallPerformance: number;
      categories: Record<string, { score: number; feedback: string }>;
      argumentQuality: { score: number; feedback: string };
      deliveryClarity: { score: number; feedback: string };
      evidenceUsage: { score: number; feedback: string };
      rebuttalEffectiveness: { score: number; feedback: string };
      detailedFeedback: string;
      suggestions: string[];
      strengthsAreas: string[];
      improvementAreas: string[];
      keyMoments: Array<{ timestamp: string; moment: string }>;
      recommendedNextSteps: string[];
    }) => {
      console.log('Debate analysis received:', analysis);
      setDebateAnalysis(analysis);
      setShowAnalysis(true);
    });

    socket.on('aiSpeech', (data: { speaker: string; text: string }) => {
      // Only show speech text briefly as a preview
      setSpeechText(data.text);
      setCurrentSpeaker(data.speaker);
      // Clear text after 3 seconds to maintain audio-only experience
      setTimeout(() => {
        setSpeechText('');
      }, 3000);
    });
    
    socket.on('aiSpeechAudio', (audioBuffer: ArrayBuffer) => {
      const buffer = audioBuffer instanceof ArrayBuffer ? audioBuffer : 
                     new Uint8Array(audioBuffer).buffer;
      setAudioQueue(prev => [...prev, new Blob([buffer], { type: 'audio/mpeg' })]);
    });

    // WebSocket streaming audio handlers
    let audioChunks: Uint8Array[] = [];
    
    socket.on('aiSpeechAudioChunk', (chunk: Buffer) => {
      // Collect audio chunks as they arrive
      const uint8Array = new Uint8Array(chunk);
      audioChunks.push(uint8Array);
    });
    
    socket.on('aiSpeechAudioEnd', () => {
      // Combine all chunks and add to audio queue
      if (audioChunks.length > 0) {
        const totalLength = audioChunks.reduce((acc, chunk) => acc + chunk.length, 0);
        const combinedChunks = new Uint8Array(totalLength);
        let offset = 0;
        
        for (const chunk of audioChunks) {
          combinedChunks.set(chunk, offset);
          offset += chunk.length;
        }
        
        const audioBlob = new Blob([combinedChunks.buffer], { type: 'audio/mpeg' });
        setAudioQueue(prev => [...prev, audioBlob]);
        
        // Clear chunks for next stream
        audioChunks = [];
      }
    });

    socket.on('debateError', (error: { message: string; error: string }) => {
      console.error('Debate error:', error);
      alert(`Debate Error: ${error.message} - ${error.error}`);
    });

    socket.on('debateSaved', (response: { success: boolean; sessionId?: string; error?: string }) => {
      if (response.success && response.sessionId) {
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 3000);
      } else {
        alert(`Failed to save debate: ${response.error}`);
        setSaveStatus('idle');
      }
    });

    socket.on('debateLoaded', (response: { success: boolean; state?: DebateState; participants?: Participant[]; transcript?: string; error?: string }) => {
      if (response.success && response.state) {
        setDebateState(response.state);
        if (response.participants && response.participants.length > 0) {
          // Reconstruct setup from loaded data
          const userParticipant = response.participants.find((p: Participant) => !p.isAI);
          if (userParticipant) {
            setSetup({
              topic: response.state.topic || 'Loaded Debate',
              side: userParticipant.team,
              aiPartner: response.participants.filter((p: Participant) => !p.isAI && p.team === userParticipant.team).length > 1,
              selectedAIDebaters: []
            });
          }
        }
      } else {
        alert(`Failed to load debate: ${response.error}`);
      }
    });
    };
    
    // Call the async initialization function
    initializeSocket();

    // Cleanup function
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [setup, participants]);

  return (
    <Layout>
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 space-y-4 animate-fade-in">
          <h1>
            Live Debate Simulator
          </h1>
          <p className="text-lg text-muted-foreground">
            Practice your debate skills with AI opponents in real-time
          </p>
          
          {/* Connection Status Alert */}
          {connectionError && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-center justify-between animate-fade-in">
              <div className="flex items-center space-x-3">
                <svg className="w-5 h-5 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span className="text-sm text-red-800 dark:text-red-200">{connectionError}</span>
              </div>
              {connectionError.includes('Click "Reconnect"') && (
                <EnhancedButton
                  onClick={() => {
                    setConnectionError(null);
                    setIsConnecting(true);
                    socketRef.current?.connect();
                  }}
                  variant="outline"
                  size="sm"
                >
                  Reconnect
                </EnhancedButton>
              )}
            </div>
          )}
          
          {/* Connecting Indicator */}
          {isConnecting && !connectionError && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 flex items-center space-x-3 animate-fade-in">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
              <span className="text-sm text-blue-800 dark:text-blue-200">Connecting to debate server...</span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Setup and Participants Sidebar */}
          <div className="lg:col-span-1 space-y-6">
            {/* Participants Panel */}
            <Card variant="default" className="animate-fade-in stagger-1">
              <CardHeader>
                <h3>Participants</h3>
                                 {!isConnected && (
                   <Badge variant="error" className="w-fit">
                     Disconnected
                   </Badge>
                 )}
                {isConnected && !debateState && (
                  <Badge variant="success" className="w-fit">
                    Connected
                  </Badge>
                )}
                {debateState && (
                  <Badge variant="primary" className="w-fit">
                    Debate Active
                  </Badge>
                )}
              </CardHeader>
              <CardContent>
                <ParticipantPanel
                  participants={participants}
                  currentSpeakerId={debateState?.currentSpeakerId || null}
                />
              </CardContent>
            </Card>

            {/* Debate Setup */}
            {!setup ? (
              <Card variant="gradient" className="animate-fade-in stagger-2">
                <CardHeader>
                  <h3>Setup Debate</h3>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSetupSubmit} className="space-y-6">
                    <div className="w-full">
                      <EnhancedInput
                        label="Debate Topic"
                        value={formData.topic}
                        onChange={(e) => setFormData(prev => ({ ...prev, topic: e.target.value }))}
                        placeholder="e.g., Should autonomous vehicles be implemented on a large scale?"
                        multiline
                        rows={3}
                        required
                        className="resize-none"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-900 dark:text-white mb-3">
                        Choose Your Side
                      </label>
                      <div className="grid grid-cols-2 gap-3">
                        <EnhancedButton
                          type="button"
                          variant={formData.side === 'PRO' ? 'primary' : 'outline'}
                          onClick={() => setFormData(prev => ({ ...prev, side: 'PRO' }))}
                          className="w-full"
                          icon={<span className="text-xl">👍</span>}
                        >
                          PRO
                        </EnhancedButton>
                        <EnhancedButton
                          type="button"
                          variant={formData.side === 'CON' ? 'danger' : 'outline'}
                          onClick={() => setFormData(prev => ({ ...prev, side: 'CON' }))}
                          className="w-full"
                          icon={<span className="text-xl">👎</span>}
                        >
                          CON
                        </EnhancedButton>
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-900 dark:text-white mb-3">
                        Select 3 AI Debaters (Currently selected: {formData.selectedAIDebaters.length}/3)
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-48 overflow-y-auto pr-2">
                        {availableAIDebaters.map((debater) => (
                          <button
                            key={debater.id}
                            type="button"
                            onClick={() => handleAIDebaterToggle(debater.name)}
                            className={`p-3 rounded-lg border-2 transition-all duration-200 text-left group relative overflow-hidden box-border min-w-0 ${
                              formData.selectedAIDebaters.includes(debater.name)
                                ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30 shadow-md'
                                : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-primary-300 dark:hover:border-primary-700 hover:shadow-sm'
                            } ${formData.selectedAIDebaters.length >= 3 && !formData.selectedAIDebaters.includes(debater.name) 
                                ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                            disabled={formData.selectedAIDebaters.length >= 3 && !formData.selectedAIDebaters.includes(debater.name)}
                          >
                            <div className="flex items-start justify-between w-full">
                              <div className="flex-1 min-w-0">
                                <div className="font-medium text-sm text-gray-900 dark:text-white truncate">
                                  {debater.name}
                                </div>
                                <div className="text-xs text-gray-600 dark:text-gray-400 mt-0.5 line-clamp-2 break-words">
                                  {debater.description}
                                </div>
                              </div>
                              {formData.selectedAIDebaters.includes(debater.name) && (
                                <div className="ml-2 flex-shrink-0">
                                  <div className="w-5 h-5 rounded-full bg-primary-500 flex items-center justify-center">
                                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} 
                                        d="M5 13l4 4L19 7" />
                                    </svg>
                                  </div>
                                </div>
                              )}
                            </div>
                            <div className={`absolute inset-0 bg-gradient-to-r from-primary-500/10 to-primary-600/10 transform transition-transform duration-300 ${
                              formData.selectedAIDebaters.includes(debater.name) ? 'translate-x-0' : '-translate-x-full'
                            }`} />
                          </button>
                        ))}
                      </div>
                      {formData.selectedAIDebaters.length < 3 && (
                        <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">
                          Please select {3 - formData.selectedAIDebaters.length} more AI debater{3 - formData.selectedAIDebaters.length !== 1 ? 's' : ''}
                        </p>
                      )}
                    </div>
                    
                    <div className="flex items-center space-x-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-primary-300 dark:hover:border-primary-700 transition-colors cursor-pointer"
                         onClick={() => setFormData(prev => ({ ...prev, aiPartner: !prev.aiPartner }))}>
                      <div className="relative">
                        <input
                          type="checkbox"
                          id="aiPartner"
                          checked={formData.aiPartner}
                          onChange={(e) => setFormData(prev => ({ ...prev, aiPartner: e.target.checked }))}
                          className="sr-only"
                        />
                        <div className={`w-10 h-6 rounded-full transition-colors ${
                          formData.aiPartner ? 'bg-primary-500' : 'bg-gray-300 dark:bg-gray-600'
                        }`}>
                          <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-md transform transition-transform ${
                            formData.aiPartner ? 'translate-x-4' : 'translate-x-0'
                          }`} />
                        </div>
                      </div>
                      <label htmlFor="aiPartner" className="text-sm text-gray-900 dark:text-white cursor-pointer flex-1">
                        Include AI Partner on my team
                        <span className="block text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                          Get assistance from an AI teammate during the debate
                        </span>
                      </label>
                    </div>
                    
                    <EnhancedButton 
                      type="submit" 
                      variant="primary" 
                      size="lg" 
                      className="w-full"
                      icon={
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} 
                            d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      }
                    >
                      Configure Debate
                    </EnhancedButton>
                  </form>
                </CardContent>
              </Card>
            ) : (
              <Card variant="default" className="animate-fade-in stagger-2">
                <CardHeader>
                  <h3>Debate Ready</h3>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">Topic:</p>
                    <p className="font-medium">{setup.topic}</p>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Your Side:</span>
                                         <Badge variant={setup.side === 'PRO' ? 'success' : 'error'}>
                       {setup.side}
                     </Badge>
                  </div>
                  {setup.aiPartner && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">AI Partner:</span>
                      <Badge variant="primary">Enabled</Badge>
                    </div>
                  )}
                  <EnhancedButton
                    onClick={startDebate}
                    disabled={!isConnected || !!debateState}
                    variant="primary"
                    size="lg"
                    className="w-full"
                    loading={!isConnected}
                    icon={
                      debateState ? (
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} 
                            d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} 
                            d="M15.75 5.25v13.5m-7.5-13.5v13.5" />
                        </svg>
                      )
                    }
                  >
                    {!isConnected ? 'Connecting...' : debateState ? 'Debate Active' : 'Start Debate'}
                  </EnhancedButton>
                </CardContent>
              </Card>
            )}

            {/* Phase Progress */}
            {debateState && (
              <Card variant="glass" className="animate-fade-in stagger-3">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <h4>Phase Progress</h4>
                    <Badge variant="primary">
                      {getCurrentPhaseIndex()}/{getTotalPhases()}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm text-muted-foreground mb-2">
                      <span>Current Phase</span>
                      <span>{getPhaseDisplayName(debateState.phase)}</span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div 
                        className="bg-primary-600 h-2 rounded-full transition-all duration-500"
                        style={{ width: `${(getCurrentPhaseIndex() / getTotalPhases()) * 100}%` }}
                      />
                    </div>
                  </div>
                  
                  {/* Timer */}
                  <div className="text-center">
                    <div className="text-3xl font-mono font-bold text-primary-600">
                      {Math.floor(debateState.remainingTime / 60).toString().padStart(2, '0')}:
                      {(debateState.remainingTime % 60).toString().padStart(2, '0')}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">Time Remaining</p>
                  </div>
                  
                  {isCrossfireActive && (
                    <div className="flex items-center gap-2 text-sm">
                      <div className="w-2 h-2 bg-orange-400 rounded-full animate-pulse" />
                      <span className="font-semibold text-orange-600">Crossfire Active</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Main Debate Area */}
          <div className="lg:col-span-2 space-y-6">
            {/* Debate Stage */}
            <Card variant="elevated" className="min-h-[400px] animate-fade-in stagger-1">
              <CardContent className="flex flex-col items-center justify-center h-full py-16">
                {debateState ? (
                  <div className="text-center space-y-8 w-full max-w-2xl">
                    {/* Current Speaker */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-center gap-3 bg-primary-50 dark:bg-primary-900/20 px-6 py-4 rounded-full">
                        <div className={`w-3 h-3 rounded-full ${currentSpeaker ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
                        <h4>
                          {currentSpeaker || 'Waiting for speaker...'}
                        </h4>
                      </div>
                      
                      {/* Audio Waveform Visualization */}
                      {currentSpeaker && (
                        <div className="flex justify-center items-center space-x-1 h-16">
                          {[...Array(30)].map((_, i) => (
                            <div
                              key={i}
                              className="w-1 bg-gradient-to-t from-primary-400 to-primary-600 rounded-full transition-all duration-300"
                              style={{
                                height: `${20 + Math.sin(Date.now() / 200 + i * 0.5) * 20 + Math.random() * 10}px`,
                                opacity: 0.6 + Math.sin(Date.now() / 200 + i * 0.5) * 0.4,
                              }}
                            />
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Speech Preview */}
                    {speechText && (
                      <Card variant="glass" className="mx-auto max-w-lg">
                        <CardContent className="text-center py-4">
                          <p className="text-sm text-muted-foreground italic">
                            &ldquo;{speechText.substring(0, 100)}{speechText.length > 100 ? '...' : ''}&rdquo;
                          </p>
                        </CardContent>
                      </Card>
                    )}

                    {/* Debate Controls */}
                    {debateState.phase !== 'ENDED' && (
                      <div className="flex flex-wrap justify-center gap-4">
                         <EnhancedButton
                           onClick={!isPaused ? pauseDebate : resumeDebate}
                           variant="secondary"
                           size="lg"
                           icon={!isPaused ? <PauseIcon className="w-5 h-5" /> : <PlayIcon className="w-5 h-5" />}
                         >
                           {!isPaused ? 'Pause' : 'Resume'}
                         </EnhancedButton>
                         
                         <EnhancedButton
                           onClick={() => socketRef.current?.emit('skipTurn')}
                           variant="ghost"
                           size="lg"
                           icon={<ForwardIcon className="w-5 h-5" />}
                         >
                           Skip Turn
                         </EnhancedButton>
                         
                         <EnhancedButton
                           onClick={() => {
                             socketRef.current?.emit('saveDebate');
                             setSaveStatus('saving');
                           }}
                           disabled={saveStatus === 'saving'}
                           variant="primary"
                           size="lg"
                           loading={saveStatus === 'saving'}
                           icon={saveStatus === 'saved' ? <CheckIcon className="w-5 h-5" /> : <BookmarkIcon className="w-5 h-5" />}
                         >
                           {saveStatus === 'saved' ? 'Saved!' : 'Save Progress'}
                         </EnhancedButton>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center space-y-4">
                    <h3 className="text-muted-foreground">
                      Ready to begin your debate
                    </h3>
                    <p className="text-muted-foreground">
                      Configure your debate settings and click "Start Debate" to begin
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

                         {/* User Turn Notification */}
             {debateState?.currentSpeakerId === (setup?.side === 'PRO' ? 'human-pro-1' : 'human-con-1') && (
               <Card variant="default" className="border-2 border-primary-400 bg-gradient-to-r from-primary-50 to-primary-100 dark:border-primary-600 dark:from-primary-900/30 dark:to-primary-800/30 shadow-lg animate-pulse-subtle">
                 <CardContent>
                   <div className="flex items-center justify-between">
                     <div className="flex items-center gap-4">
                       <div className="w-12 h-12 rounded-full bg-primary-500 flex items-center justify-center animate-bounce">
                         <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                             d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                         </svg>
                       </div>
                       <div>
                         <h4 className="font-bold text-lg text-primary-800 dark:text-primary-200">
                           Your Turn to Speak!
                         </h4>
                         <p className="text-sm text-primary-700 dark:text-primary-300">
                           {getPhaseDisplayName(debateState.phase)} • {Math.floor(debateState.remainingTime / 60)}:{(debateState.remainingTime % 60).toString().padStart(2, '0')} remaining
                         </p>
                       </div>
                     </div>
                     <EnhancedButton 
                       onClick={skipUserTurn} 
                       variant="ghost" 
                       size="sm"
                       icon={<ForwardIcon className="w-4 h-4" />}
                     >
                       Skip My Turn
                     </EnhancedButton>
                   </div>
                 </CardContent>
               </Card>
             )}

            {/* Audio and Recording Controls */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Audio Player */}
              <Card variant="default" className="animate-fade-in stagger-2">
                <CardHeader>
                  <h4>Audio Output</h4>
                </CardHeader>
                <CardContent>
                  <StreamingAudioPlayer audioQueue={audioQueue} setAudioQueue={setAudioQueue} />
                </CardContent>
              </Card>
              
              {/* Recording Controls */}
              <Card variant="default" className="animate-fade-in stagger-3">
                <CardHeader>
                  <h4>Voice Input</h4>
                </CardHeader>
                <CardContent>
                  <AudioRecorder 
                    onTranscription={handleUserSpeech} 
                    disabled={!debateState}
                    onRecordedAudio={(blob) => setAudioQueue(prev => [...prev, blob])}
                  />
                  {isCrossfireActive && (
                    <div className="mt-4">
                      <CrossfireController />
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>

        {/* Advice Panel Toggle */}
        {setup && (
          <div className="fixed bottom-6 right-6 z-40">
            <EnhancedButton
              onClick={() => setIsResearchPanelVisible(!isResearchPanelVisible)}
              variant="primary"
              size="lg"
              className="rounded-full shadow-lg"
              icon={
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} 
                    d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              }
            >
              {isResearchPanelVisible ? 'Close Advice' : 'Get Advice'}
            </EnhancedButton>
          </div>
        )}
      </div>

      {/* Post-Debate Analysis Modal */}
      {showAnalysis && debateAnalysis && (
        <Modal
          isOpen={showAnalysis}
          onClose={() => setShowAnalysis(false)}
          title="🎯 Debate Performance Analysis"
          size="lg"
        >
          <div className="space-y-6">
            {/* Overall Score */}
            <Card variant="gradient">
              <CardContent>
                <div className="flex items-center justify-between text-gray-900 dark:text-white">
                  <h4>
                    Overall Performance Score
                  </h4>
                  <div className="text-3xl font-bold">
                    {debateAnalysis.overallScore}/100
                  </div>
                </div>
                <div className="mt-3 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                  <div 
                    className="bg-primary-500 dark:bg-primary-400 h-3 rounded-full transition-all duration-500"
                    style={{ width: `${debateAnalysis.overallScore}%` }}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Detailed Metrics */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm font-medium">Argument Quality</span>
                  <Badge variant="primary">{debateAnalysis.argumentQuality.score}/10</Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm font-medium">Delivery Clarity</span>
                  <Badge variant="primary">{debateAnalysis.deliveryClarity.score}/10</Badge>
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm font-medium">Evidence Usage</span>
                  <Badge variant="primary">{debateAnalysis.evidenceUsage.score}/10</Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm font-medium">Rebuttal Effectiveness</span>
                  <Badge variant="primary">{debateAnalysis.rebuttalEffectiveness.score}/10</Badge>
                </div>
              </div>
            </div>

            {/* Detailed Feedback */}
            <Card variant="default">
              <CardHeader>
                <h4>📝 Detailed Feedback</h4>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground leading-relaxed">
                  {debateAnalysis.detailedFeedback}
                </p>
              </CardContent>
            </Card>

                         {/* Strengths and Improvements */}
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
               <Card variant="default" className="border-primary-200 bg-primary-50 dark:border-primary-800 dark:bg-primary-900/20">
                 <CardHeader>
                   <h4 className="text-primary-800 dark:text-primary-200">
                     ✅ Strengths
                   </h4>
                 </CardHeader>
                 <CardContent>
                   <ul className="space-y-2">
                     {Array.isArray(debateAnalysis.strengthsAreas) && debateAnalysis.strengthsAreas.map((strength: string, index: number) => (
                       <li key={index} className="text-sm flex items-start">
                         <span className="text-primary-500 mr-2">•</span>
                         {strength}
                       </li>
                     ))}
                   </ul>
                 </CardContent>
               </Card>
               
               <Card variant="default" className="border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/20">
                 <CardHeader>
                   <h4 className="text-gray-800 dark:text-gray-200">
                     🎯 Areas for Improvement
                   </h4>
                 </CardHeader>
                 <CardContent>
                   <ul className="space-y-2">
                     {Array.isArray(debateAnalysis.improvementAreas) && debateAnalysis.improvementAreas.map((improvement: string, index: number) => (
                       <li key={index} className="text-sm flex items-start">
                         <span className="text-gray-500 mr-2">•</span>
                         {improvement}
                       </li>
                     ))}
                   </ul>
                 </CardContent>
               </Card>
             </div>

            {/* Key Moments */}
            {Array.isArray(debateAnalysis.keyMoments) && debateAnalysis.keyMoments.length > 0 && (
              <Card variant="default">
                <CardHeader>
                  <h4>🌟 Key Moments</h4>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {debateAnalysis.keyMoments.map((moment: { timestamp: string; moment: string }, index: number) => (
                      <li key={index} className="text-sm flex items-start">
                        <span className="text-primary-500 mr-2">•</span>
                        <span className="text-xs text-gray-500 dark:text-gray-400 mr-2">{moment.timestamp}</span>
                        {moment.moment}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {/* Next Steps */}
            <Card variant="default">
              <CardHeader>
                <h4>🚀 Recommended Next Steps</h4>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {Array.isArray(debateAnalysis.recommendedNextSteps) && debateAnalysis.recommendedNextSteps.map((step: string, index: number) => (
                    <li key={index} className="text-sm flex items-start">
                      <span className="text-primary-500 mr-2">•</span>
                      {step}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <EnhancedButton
                onClick={() => {
                  setShowAnalysis(false);
                  // Reset for new debate
                  setDebateState(null);
                  setSetup(null);
                  setDebateAnalysis(null);
                }}
                variant="primary"
                className="flex-1"
                icon={
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} 
                      d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                }
              >
                Start New Debate
              </EnhancedButton>
              <EnhancedButton
                onClick={() => setShowAnalysis(false)}
                variant="secondary"
                className="flex-1"
                icon={
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} 
                      d="M6 18L18 6M6 6l12 12" />
                  </svg>
                }
              >
                Close Analysis
              </EnhancedButton>
            </div>
          </div>
        </Modal>
      )}

      {/* Wiki Search Panel */}
      {setup && (
        <WikiSearchPanel
          debateTopic={setup.topic}
          userPerspective={setup.side}
          isVisible={isResearchPanelVisible}
          onToggle={() => setIsResearchPanelVisible(!isResearchPanelVisible)}
          currentSpeaker={currentSpeaker}
        />
      )}
    </Layout>
  );
}