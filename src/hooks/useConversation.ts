'use client';

import { useState, useRef, useCallback } from 'react';
import { Conversation } from '@11labs/client';
import type { Status, Mode } from '@11labs/client';

export interface TranscriptEntry {
  role: 'user' | 'ai';
  text: string;
  timestamp: number;
}

interface UseConversationCallbacks {
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (message: string) => void;
}

export function useConversation(callbacks?: UseConversationCallbacks) {
  const [status, setStatus] = useState<Status>('disconnected');
  const [mode, setMode] = useState<Mode>('listening');
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [isMuted, setIsMuted] = useState(false);
  const conversationRef = useRef<Conversation | null>(null);
  // Store callbacks in a ref so `start` doesn't need them as deps
  const callbacksRef = useRef(callbacks);
  callbacksRef.current = callbacks;

  const start = useCallback(
    async (signedUrl: string, systemPrompt: string, firstMessage: string) => {
      if (conversationRef.current) {
        await conversationRef.current.endSession();
      }

      setTranscript([]);
      setIsMuted(false);
      setStatus('connecting');

      // Request mic permission before starting (required by SDK)
      await navigator.mediaDevices.getUserMedia({ audio: true });

      const conversation = await Conversation.startSession({
        signedUrl,
        overrides: {
          agent: {
            prompt: { prompt: systemPrompt },
            firstMessage,
            language: 'en',
          },
        },
        onConnect: () => {
          setStatus('connected');
          callbacksRef.current?.onConnect?.();
        },
        onDisconnect: () => {
          setStatus('disconnected');
          setMode('listening');
          conversationRef.current = null;
          callbacksRef.current?.onDisconnect?.();
        },
        onError: (message: string) => {
          callbacksRef.current?.onError?.(message);
        },
        onMessage: ({ message, source }) => {
          setTranscript((prev) => [
            ...prev,
            {
              role: source === 'user' ? 'user' : 'ai',
              text: message,
              timestamp: Date.now(),
            },
          ]);
        },
        onModeChange: ({ mode: newMode }) => {
          setMode(newMode);
        },
        onStatusChange: ({ status: newStatus }) => {
          setStatus(newStatus);
        },
      });

      conversationRef.current = conversation;
    },
    [] // No deps needed — callbacks accessed via ref
  );

  const stop = useCallback(async () => {
    if (conversationRef.current) {
      await conversationRef.current.endSession();
      conversationRef.current = null;
    }
  }, []);

  const toggleMute = useCallback(() => {
    if (conversationRef.current) {
      setIsMuted((prev) => {
        const newMuted = !prev;
        conversationRef.current?.setMicMuted(newMuted);
        return newMuted;
      });
    }
  }, []);

  return {
    status,
    mode,
    transcript,
    isMuted,
    start,
    stop,
    toggleMute,
  };
}
