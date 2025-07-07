'use client';

import { useEffect, useState, useRef, FormEvent } from 'react';
import { io, Socket } from 'socket.io-client';
import {
  Participant,
  DebateState,
} from '@/backend/modules/realtimeDebate/debate-types';
import { debateConfig } from '@/backend/modules/realtimeDebate/debate.config';
import ParticipantPanel from '../../components/debate/ParticipantPanel';
import { WikiSearchPanel } from '@/components/debate/WikiSearchPanel';
import StreamingAudioPlayer from '../../components/debate/StreamingAudioPlayer';
import AudioRecorder from '../../components/debate/AudioRecorder';
import CrossfireController from '../../components/debate/CrossfireControls';
import Layout from '@/components/layout/Layout';
import { Card, CardHeader, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Textarea';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { PlayIcon, PauseIcon, ForwardIcon, BookmarkIcon, CheckIcon } from '@heroicons/react/24/outline';

type DebateSetup = {
  topic: string;
  side: 'PRO' | 'CON';
  aiPartner: boolean;
  selectedAIDebaters: string[]; // Array of 3 selected AI debater names
};

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
  const [audioQueue, setAudioQueue] = useState<Blob[]>([]);
  const [isCrossfireActive, setIsCrossfireActive] = useState<boolean>(false);
  const socketRef = useRef<Socket | null>(null);

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

  // Get available AI debaters from config
  const availableAIDebaters = Object.values(debateConfig.personalities);

  const handleAIDebaterToggle = (debaterName: string) => {
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
  };

  useEffect(() => {
    // This fetch call is necessary to initialize the socket.io server on the backend.
    fetch('/api/socketio');

    const socket: Socket = io({
      path: '/api/socketio',
    });
    
    socketRef.current = socket;

    socket.on('connect', () => setIsConnected(true));
    socket.on('disconnect', () => setIsConnected(false));

    socket.on('debateStateUpdate', (newState: DebateState, mode: string) => {
      console.log('Debate state update:', newState, mode);
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
          const participants = createParticipants(setup);
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
      console.log('AI speech received:', data);
      // Only show speech text briefly as a preview
      setSpeechText(data.text);
      setCurrentSpeaker(data.speaker);
      // Clear text after 3 seconds to maintain audio-only experience
      setTimeout(() => {
        setSpeechText('');
      }, 3000);
    });
    
    socket.on('aiSpeechAudio', (audioBuffer: ArrayBuffer) => {
      console.log('AI speech audio received:', audioBuffer.byteLength, 'bytes');
      const buffer = audioBuffer instanceof ArrayBuffer ? audioBuffer : 
                     new Uint8Array(audioBuffer).buffer;
      setAudioQueue(prev => [...prev, new Blob([buffer], { type: 'audio/mpeg' })]);
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

    return () => {
      socket.disconnect();
    };
  }, [setup]);

  const handleSetupSubmit = (e: FormEvent) => {
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
  };

  const startDebate = () => {
    if (!setup) return;
    if (!isConnected) {
      alert('Not connected to server. Please refresh the page.');
      return;
    }
    const participants = createParticipants(setup);
    console.log('Starting debate with participants:', participants);
    socketRef.current?.emit('startDebate', { topic: setup.topic, participants });
  };
  
  const handleUserSpeech = (text: string) => {
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
  };

  const skipUserTurn = () => {
    const userSpeakerId = setup?.side === 'PRO' ? 'human-pro-1' : 'human-con-1';
    if (socketRef.current && debateState?.currentSpeakerId === userSpeakerId) {
      const mockSpeech = `Thank you for this opportunity. I believe my fellow debater has already made our key points well, and I yield the remainder of my time.`;
      handleUserSpeech(mockSpeech);
    }
  };

  const getPhaseDisplayName = (phase: string) => {
    return phase.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const getTotalPhases = () => 11;
  const getCurrentPhaseIndex = () => {
    const phases = ['PRO_CONSTRUCTIVE', 'CON_CONSTRUCTIVE', 'CROSSFIRE_1', 'PRO_REBUTTAL', 'CON_REBUTTAL', 'CROSSFIRE_2', 'PRO_SUMMARY', 'CON_SUMMARY', 'GRAND_CROSSFIRE', 'PRO_FINAL_FOCUS', 'CON_FINAL_FOCUS'];
    return phases.indexOf(debateState?.phase || '') + 1;
  };

  const pauseDebate = () => {
    if (socketRef.current) {
      socketRef.current.emit('pauseDebate');
      setIsPaused(true);
    }
  };

  const resumeDebate = () => {
    if (socketRef.current) {
      socketRef.current.emit('resumeDebate');
      setIsPaused(false);
    }
  };

  return (
    <Layout>
      <div className="mx-auto max-w-7xl">
        <div className="mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-primary-600 to-accent-600 bg-clip-text text-transparent">
            Live Debate Simulator
          </h1>
          <p className="mt-2 text-lg text-muted-foreground">
            Practice your debate skills with AI opponents in real-time
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Setup and Participants Sidebar */}
          <div className="lg:col-span-1 space-y-6">
            {/* Participants Panel */}
            <Card variant="default">
              <CardHeader>
                <h2 className="text-xl font-semibold">Participants</h2>
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
                  participants={setup ? createParticipants(setup) : []}
                  currentSpeakerId={debateState?.currentSpeakerId || null}
                />
              </CardContent>
            </Card>

            {/* Debate Setup */}
            {!setup ? (
              <Card variant="gradient">
                <CardHeader>
                  <h2 className="text-xl font-semibold text-white">Setup Debate</h2>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSetupSubmit} className="space-y-6">
                    <Textarea
                      label="Debate Topic"
                      value={formData.topic}
                      onChange={(e) => setFormData(prev => ({ ...prev, topic: e.target.value }))}
                      placeholder="e.g., Should autonomous vehicles be implemented on a large scale?"
                      rows={3}
                      required
                    />
                    
                    <div>
                      <label className="block text-sm font-medium text-white mb-3">
                        Choose Your Side
                      </label>
                      <div className="grid grid-cols-2 gap-3">
                        <Button
                          type="button"
                          variant={formData.side === 'PRO' ? 'success' : 'outline'}
                          onClick={() => setFormData(prev => ({ ...prev, side: 'PRO' }))}
                          className="w-full"
                        >
                          👍 PRO
                        </Button>
                        <Button
                          type="button"
                          variant={formData.side === 'CON' ? 'danger' : 'outline'}
                          onClick={() => setFormData(prev => ({ ...prev, side: 'CON' }))}
                          className="w-full"
                        >
                          👎 CON
                        </Button>
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-white mb-3">
                        Select 3 AI Debaters (Currently selected: {formData.selectedAIDebaters.length}/3)
                      </label>
                      <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">
                        {availableAIDebaters.map((debater) => (
                          <button
                            key={debater.id}
                            type="button"
                            onClick={() => handleAIDebaterToggle(debater.name)}
                            className={`p-2 text-xs rounded-lg border transition-all text-left ${
                              formData.selectedAIDebaters.includes(debater.name)
                                ? 'border-blue-400 bg-blue-100 text-blue-800'
                                : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                            } ${formData.selectedAIDebaters.length >= 3 && !formData.selectedAIDebaters.includes(debater.name) 
                                ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                            disabled={formData.selectedAIDebaters.length >= 3 && !formData.selectedAIDebaters.includes(debater.name)}
                          >
                            <div className="font-medium">{debater.name}</div>
                            <div className="text-xs opacity-75 truncate">{debater.description}</div>
                          </button>
                        ))}
                      </div>
                      {formData.selectedAIDebaters.length < 3 && (
                        <p className="text-xs text-yellow-200 mt-2">
                          Please select {3 - formData.selectedAIDebaters.length} more AI debater{3 - formData.selectedAIDebaters.length !== 1 ? 's' : ''}
                        </p>
                      )}
                    </div>
                    
                    <div className="flex items-center space-x-3">
                      <input
                        type="checkbox"
                        id="aiPartner"
                        checked={formData.aiPartner}
                        onChange={(e) => setFormData(prev => ({ ...prev, aiPartner: e.target.checked }))}
                        className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
                      />
                      <label htmlFor="aiPartner" className="text-sm text-white">
                        Include AI Partner on my team
                      </label>
                    </div>
                    
                    <Button type="submit" variant="primary" size="lg" className="w-full">
                      Configure Debate
                    </Button>
                  </form>
                </CardContent>
              </Card>
            ) : (
              <Card variant="default">
                <CardHeader>
                  <h2 className="text-xl font-semibold">Debate Ready</h2>
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
                  <Button
                    onClick={startDebate}
                    disabled={!isConnected || !!debateState}
                    variant="primary"
                    size="lg"
                    className="w-full"
                  >
                    {!isConnected ? 'Connecting...' : debateState ? 'Debate Active' : 'Start Debate'}
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Phase Progress */}
            {debateState && (
              <Card variant="glass">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">Phase Progress</h3>
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
            <Card variant="elevated" className="min-h-[400px]">
              <CardContent className="flex flex-col items-center justify-center h-full py-16">
                {debateState ? (
                  <div className="text-center space-y-8 w-full max-w-2xl">
                    {/* Current Speaker */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-center gap-3 bg-primary-50 dark:bg-primary-900/20 px-6 py-4 rounded-full">
                        <div className={`w-3 h-3 rounded-full ${currentSpeaker ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
                        <h2 className="text-xl font-semibold">
                          {currentSpeaker || 'Waiting for speaker...'}
                        </h2>
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
                                                 <Button
                           onClick={!isPaused ? pauseDebate : resumeDebate}
                           variant="secondary"
                           size="lg"
                         >
                           {!isPaused ? (
                             <>
                               <PauseIcon className="w-5 h-5 mr-2" />
                               Pause
                             </>
                           ) : (
                             <>
                               <PlayIcon className="w-5 h-5 mr-2" />
                               Resume
                             </>
                           )}
                         </Button>
                         
                         <Button
                           onClick={() => socketRef.current?.emit('skipTurn')}
                           variant="ghost"
                           size="lg"
                         >
                           <ForwardIcon className="w-5 h-5 mr-2" />
                           Skip Turn
                         </Button>
                         
                         <Button
                           onClick={() => {
                             socketRef.current?.emit('saveDebate');
                             setSaveStatus('saving');
                           }}
                           disabled={saveStatus === 'saving'}
                           variant="accent"
                           size="lg"
                           isLoading={saveStatus === 'saving'}
                         >
                           {saveStatus === 'saved' ? (
                             <>
                               <CheckIcon className="w-5 h-5 mr-2" />
                               Saved!
                             </>
                           ) : (
                             <>
                               <BookmarkIcon className="w-5 h-5 mr-2" />
                               Save Progress
                             </>
                           )}
                         </Button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center space-y-4">
                    <h2 className="text-2xl font-bold text-muted-foreground">
                      Ready to begin your debate
                    </h2>
                    <p className="text-muted-foreground">
                      Configure your debate settings and click "Start Debate" to begin
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

                         {/* User Turn Notification */}
             {debateState?.currentSpeakerId === (setup?.side === 'PRO' ? 'human-pro-1' : 'human-con-1') && (
               <Card variant="default" className="border-success-200 bg-success-50 dark:border-success-800 dark:bg-success-900/20">
                 <CardContent>
                   <div className="flex items-center justify-between">
                     <div>
                       <h4 className="font-semibold text-success-800 dark:text-success-200 mb-1">
                         🎤 Your Turn to Speak!
                       </h4>
                       <p className="text-sm text-success-700 dark:text-success-300">
                         Phase: {getPhaseDisplayName(debateState.phase)}
                       </p>
                     </div>
                     <Button onClick={skipUserTurn} variant="ghost" size="sm">
                       Skip My Turn
                     </Button>
                   </div>
                 </CardContent>
               </Card>
             )}

            {/* Audio and Recording Controls */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Audio Player */}
              <Card variant="default">
                <CardHeader>
                  <h3 className="text-lg font-semibold">Audio Output</h3>
                </CardHeader>
                <CardContent>
                  <StreamingAudioPlayer audioQueue={audioQueue} setAudioQueue={setAudioQueue} />
                </CardContent>
              </Card>
              
              {/* Recording Controls */}
              <Card variant="default">
                <CardHeader>
                  <h3 className="text-lg font-semibold">Voice Input</h3>
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

        {/* Research Panel Toggle */}
        {setup && (
          <div className="fixed bottom-6 right-6 z-40">
            <Button
              onClick={() => setIsResearchPanelVisible(!isResearchPanelVisible)}
              variant="primary"
              size="lg"
              className="rounded-full shadow-lg"
            >
              {isResearchPanelVisible ? 'Close Research' : 'Open Research'}
            </Button>
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
                <div className="flex items-center justify-between text-white">
                  <h3 className="text-lg font-semibold">
                    Overall Performance Score
                  </h3>
                  <div className="text-3xl font-bold">
                    {debateAnalysis.overallScore}/100
                  </div>
                </div>
                <div className="mt-3 w-full bg-white/20 rounded-full h-3">
                  <div 
                    className="bg-white h-3 rounded-full transition-all duration-500"
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
                <h3 className="text-lg font-semibold">📝 Detailed Feedback</h3>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground leading-relaxed">
                  {debateAnalysis.detailedFeedback}
                </p>
              </CardContent>
            </Card>

                         {/* Strengths and Improvements */}
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
               <Card variant="default" className="border-success-200 bg-success-50 dark:border-success-800 dark:bg-success-900/20">
                 <CardHeader>
                   <h3 className="text-lg font-semibold text-success-800 dark:text-success-200">
                     ✅ Strengths
                   </h3>
                 </CardHeader>
                 <CardContent>
                   <ul className="space-y-2">
                     {Array.isArray(debateAnalysis.strengthsAreas) && debateAnalysis.strengthsAreas.map((strength: string, index: number) => (
                       <li key={index} className="text-sm flex items-start">
                         <span className="text-success-500 mr-2">•</span>
                         {strength}
                       </li>
                     ))}
                   </ul>
                 </CardContent>
               </Card>
               
               <Card variant="default" className="border-warning-200 bg-warning-50 dark:border-warning-800 dark:bg-warning-900/20">
                 <CardHeader>
                   <h3 className="text-lg font-semibold text-warning-800 dark:text-warning-200">
                     🎯 Areas for Improvement
                   </h3>
                 </CardHeader>
                 <CardContent>
                   <ul className="space-y-2">
                     {Array.isArray(debateAnalysis.improvementAreas) && debateAnalysis.improvementAreas.map((improvement: string, index: number) => (
                       <li key={index} className="text-sm flex items-start">
                         <span className="text-warning-500 mr-2">•</span>
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
                  <h3 className="text-lg font-semibold">🌟 Key Moments</h3>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {debateAnalysis.keyMoments.map((moment: { timestamp: string; moment: string }, index: number) => (
                      <li key={index} className="text-sm flex items-start">
                        <span className="text-primary-500 mr-2">•</span>
                        <span className="text-xs text-gray-500 mr-2">{moment.timestamp}</span>
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
                <h3 className="text-lg font-semibold">🚀 Recommended Next Steps</h3>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {Array.isArray(debateAnalysis.recommendedNextSteps) && debateAnalysis.recommendedNextSteps.map((step: string, index: number) => (
                    <li key={index} className="text-sm flex items-start">
                      <span className="text-accent-500 mr-2">•</span>
                      {step}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <Button
                onClick={() => {
                  setShowAnalysis(false);
                  // Reset for new debate
                  setDebateState(null);
                  setSetup(null);
                  setDebateAnalysis(null);
                }}
                variant="primary"
                className="flex-1"
              >
                Start New Debate
              </Button>
              <Button
                onClick={() => setShowAnalysis(false)}
                variant="secondary"
                className="flex-1"
              >
                Close Analysis
              </Button>
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
        />
      )}
    </Layout>
  );
} 