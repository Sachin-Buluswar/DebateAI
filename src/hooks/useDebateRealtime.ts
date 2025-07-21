import { useEffect, useState, useCallback, useRef } from 'react';
import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabaseClient';
import { DebateState, Participant } from '@/backend/modules/realtimeDebate/debate-types';

interface UseDebateRealtimeOptions {
  debateId: string;
  userId: string;
  onStateUpdate?: (state: DebateState) => void;
  onSpeechReceived?: (data: any) => void;
  onCrossfireMessage?: (data: any) => void;
  onParticipantJoined?: (participant: any) => void;
  onParticipantLeft?: (participant: any) => void;
  onError?: (error: Error) => void;
}

interface UseDebateRealtimeReturn {
  connected: boolean;
  channel: RealtimeChannel | null;
  presence: Record<string, any>;
  sendMessage: (event: string, payload: any) => Promise<void>;
  sendCrossfireMessage: (message: any) => Promise<void>;
  updateDebateState: (state: Partial<DebateState>) => Promise<void>;
  disconnect: () => Promise<void>;
}

export function useDebateRealtime({
  debateId,
  userId,
  onStateUpdate,
  onSpeechReceived,
  onCrossfireMessage,
  onParticipantJoined,
  onParticipantLeft,
  onError
}: UseDebateRealtimeOptions): UseDebateRealtimeReturn {
  const [connected, setConnected] = useState(false);
  const [presence, setPresence] = useState<Record<string, any>>({});
  const channelRef = useRef<RealtimeChannel | null>(null);

  // Send message to channel
  const sendMessage = useCallback(async (event: string, payload: any) => {
    if (!channelRef.current) {
      throw new Error('Not connected to debate channel');
    }

    await channelRef.current.send({
      type: 'broadcast',
      event,
      payload: {
        ...payload,
        userId,
        timestamp: Date.now()
      }
    });
  }, [userId]);

  // Send crossfire message with priority
  const sendCrossfireMessage = useCallback(async (message: any) => {
    await sendMessage('crossfire_message', {
      ...message,
      priority: 'high'
    });
  }, [sendMessage]);

  // Update debate state
  const updateDebateState = useCallback(async (state: Partial<DebateState>) => {
    await sendMessage('debate_state_update', state);
  }, [sendMessage]);

  // Disconnect from channel
  const disconnect = useCallback(async () => {
    if (channelRef.current) {
      await channelRef.current.untrack();
      await channelRef.current.unsubscribe();
      channelRef.current = null;
      setConnected(false);
      setPresence({});
    }
  }, []);

  useEffect(() => {
    // Create and subscribe to channel
    const channel = supabase.channel(`debate:${debateId}`, {
      config: {
        presence: {
          key: userId,
        },
      },
    });

    channelRef.current = channel;

    // Handle broadcast events
    channel.on('broadcast', { event: 'debate_state_update' }, ({ payload }) => {
      onStateUpdate?.(payload);
    });

    channel.on('broadcast', { event: 'speech_received' }, ({ payload }) => {
      onSpeechReceived?.(payload);
    });

    channel.on('broadcast', { event: 'crossfire_message' }, ({ payload }) => {
      onCrossfireMessage?.(payload);
    });

    // Handle presence events
    channel.on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState();
      setPresence(state);
    });

    channel.on('presence', { event: 'join' }, ({ key, newPresences }) => {
      onParticipantJoined?.({ userId: key, data: newPresences });
    });

    channel.on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
      onParticipantLeft?.({ userId: key, data: leftPresences });
    });

    // Subscribe to channel
    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        setConnected(true);
        
        // Track presence
        await channel.track({
          userId,
          online_at: new Date().toISOString(),
          user_agent: navigator.userAgent
        });
        
        console.log('Connected to debate channel:', debateId);
      } else if (status === 'CHANNEL_ERROR') {
        onError?.(new Error('Failed to connect to debate channel'));
      }
    });

    // Cleanup on unmount
    return () => {
      disconnect();
    };
  }, [debateId, userId, onStateUpdate, onSpeechReceived, onCrossfireMessage, onParticipantJoined, onParticipantLeft, onError, disconnect]);

  return {
    connected,
    channel: channelRef.current,
    presence,
    sendMessage,
    sendCrossfireMessage,
    updateDebateState,
    disconnect
  };
}

// Hook for crossfire-specific functionality
export function useCrossfireRealtime(debateId: string, userId: string) {
  const [messages, setMessages] = useState<any[]>([]);
  const [participants, setParticipants] = useState<string[]>([]);
  
  const { connected, sendCrossfireMessage, presence } = useDebateRealtime({
    debateId,
    userId,
    onCrossfireMessage: (data) => {
      setMessages(prev => [...prev, data]);
    },
    onParticipantJoined: ({ userId }) => {
      setParticipants(prev => [...prev, userId]);
    },
    onParticipantLeft: ({ userId }) => {
      setParticipants(prev => prev.filter(p => p !== userId));
    }
  });

  const sendMessage = useCallback(async (text: string) => {
    await sendCrossfireMessage({
      text,
      speakerId: userId,
      timestamp: Date.now()
    });
  }, [sendCrossfireMessage, userId]);

  return {
    connected,
    messages,
    participants: Object.keys(presence),
    sendMessage
  };
}