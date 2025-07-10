'use client';

import { useState, useEffect } from 'react';
import { cn } from '@/utils/cn';

interface EnhancedDebateStageProps {
  currentSpeaker?: {
    id: string;
    name: string;
    team: 'PRO' | 'CON';
    role: string;
  };
  phase: string;
  timeRemaining: number;
  isRecording?: boolean;
  audioLevel?: number;
  onPause?: () => void;
  onResume?: () => void;
  onSkip?: () => void;
  isPaused?: boolean;
}

export default function EnhancedDebateStage({
  currentSpeaker,
  phase,
  timeRemaining,
  isRecording = false,
  audioLevel = 0,
  onPause,
  onResume,
  onSkip,
  isPaused = false
}: EnhancedDebateStageProps) {
  const [speakerTransition, setSpeakerTransition] = useState(false);
  const [previousSpeaker, setPreviousSpeaker] = useState(currentSpeaker);

  // Handle speaker transitions with animation
  useEffect(() => {
    if (currentSpeaker?.id !== previousSpeaker?.id) {
      setSpeakerTransition(true);
      setTimeout(() => {
        setPreviousSpeaker(currentSpeaker);
        setSpeakerTransition(false);
      }, 300);
    }
  }, [currentSpeaker, previousSpeaker]);

  // Format time as MM:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Generate audio visualization bars
  const generateAudioBars = () => {
    const barCount = 40;
    const bars = [];
    
    for (let i = 0; i < barCount; i++) {
      const randomHeight = isRecording 
        ? Math.random() * audioLevel * 100 + 10
        : 10;
      
      bars.push(
        <div
          key={i}
          className={cn(
            'w-1 bg-gradient-to-t transition-all duration-300',
            currentSpeaker?.team === 'PRO' 
              ? 'from-[#87A96B] to-[#a5c088]' 
              : 'from-red-400 to-red-300',
            isRecording && 'animate-pulse'
          )}
          style={{
            height: `${randomHeight}%`,
            animationDelay: `${i * 50}ms`,
            transform: `scaleY(${isRecording ? 1 : 0.3})`
          }}
        />
      );
    }
    return bars;
  };

  return (
    <div className="relative space-y-6">
      {/* Phase Indicator */}
      <div className="text-center">
        <p className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
          current phase
        </p>
        <h2 className="text-2xl font-semibold text-gray-900 dark:text-white lowercase">
          {phase}
        </h2>
      </div>

      {/* Main Stage Card */}
      <div className={cn(
        'relative bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-8 overflow-hidden transition-all duration-500',
        speakerTransition && 'scale-95 opacity-50'
      )}>
        {/* Team color accent */}
        <div 
          className={cn(
            'absolute top-0 left-0 w-full h-1 transition-all duration-500',
            currentSpeaker?.team === 'PRO' ? 'bg-[#87A96B]' : 'bg-red-500'
          )}
        />

        {/* Speaker Info */}
        <div className="text-center mb-8">
          <div className={cn(
            'transition-all duration-500 transform',
            speakerTransition ? 'translate-y-4 opacity-0' : 'translate-y-0 opacity-100'
          )}>
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
              {currentSpeaker?.team} team • {currentSpeaker?.role?.replace(/_/g, ' ').toLowerCase()}
            </p>
            <h3 className="text-3xl font-semibold text-gray-900 dark:text-white">
              {currentSpeaker?.name || 'waiting for speaker...'}
            </h3>
          </div>
        </div>

        {/* Timer Display */}
        <div className="text-center mb-8">
          <div className={cn(
            'inline-flex items-center justify-center px-8 py-4 bg-gray-100 dark:bg-gray-800 rounded-lg',
            timeRemaining < 30 && 'bg-red-100 dark:bg-red-900/20',
            timeRemaining < 10 && 'animate-pulse'
          )}>
            <span className={cn(
              'text-5xl font-mono font-bold tracking-wider',
              timeRemaining < 30 ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'
            )}>
              {formatTime(timeRemaining)}
            </span>
          </div>
        </div>

        {/* Audio Visualization */}
        <div className="relative h-24 mb-8">
          <div className="absolute inset-0 flex items-center justify-center gap-1">
            {generateAudioBars()}
          </div>
          {isRecording && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-xs font-medium text-gray-500 dark:text-gray-400 bg-white/90 dark:bg-gray-900/90 px-3 py-1 rounded-full">
                listening...
              </div>
            </div>
          )}
        </div>

        {/* Control Buttons */}
        <div className="flex items-center justify-center gap-4">
          {isPaused ? (
            <button
              onClick={onResume}
              className="flex items-center gap-2 px-6 py-3 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-200 transition-all duration-300"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="lowercase">resume debate</span>
            </button>
          ) : (
            <button
              onClick={onPause}
              className="flex items-center gap-2 px-6 py-3 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-all duration-300"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="lowercase">pause debate</span>
            </button>
          )}
          
          <button
            onClick={onSkip}
            className="flex items-center gap-2 px-6 py-3 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-900 transition-all duration-300"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
            </svg>
            <span className="lowercase">skip turn</span>
          </button>
        </div>

        {/* Status Indicator */}
        {isPaused && (
          <div className="absolute top-4 right-4 flex items-center gap-2 px-3 py-1 bg-yellow-100 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400 rounded-full text-sm">
            <div className="w-2 h-2 bg-current rounded-full animate-pulse" />
            <span>paused</span>
          </div>
        )}
      </div>

      {/* Phase Progress Bar */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm text-gray-500 dark:text-gray-400">
          <span>progress</span>
          <span>phase {phase.match(/\d+/)?.[0] || '1'} of 11</span>
        </div>
        <div className="h-2 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-[#87A96B] to-[#a5c088] transition-all duration-500"
            style={{ width: `${(parseInt(phase.match(/\d+/)?.[0] || '1') / 11) * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
}