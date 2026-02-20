import { Socket } from 'socket.io-client';
import { createSocket as createSocketIO, isVercel } from '@/lib/socket/socketConfig';
import { createSupabaseRealtimeSocket, SupabaseRealtimeAdapter } from './supabaseRealtimeAdapter';
import { supabase } from '@/lib/supabaseClient';

export type RealtimeSocket = Socket | SupabaseRealtimeAdapter;

export interface RealtimeConfig {
  useSupabase?: boolean;
  debateId?: string;
  token?: string;
}

/**
 * Factory to create the appropriate real-time connection based on environment
 */
export async function createRealtimeConnection(config: RealtimeConfig = {}): Promise<RealtimeSocket> {
  // Check if we should use Supabase Realtime
  const shouldUseSupabase = config.useSupabase || 
    isVercel() || 
    process.env.NEXT_PUBLIC_USE_SUPABASE_REALTIME === 'true';

  if (shouldUseSupabase) {
    // PRODUCTION: Console disabled
    // console.log('Using Supabase Realtime for WebSocket connection');
    
    // Get current user
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) {
      throw new Error('User must be authenticated for real-time features');
    }
    
    // Create Supabase adapter
    const adapter = createSupabaseRealtimeSocket(user.id);
    
    // If debateId provided, connect immediately
    if (config.debateId) {
      await adapter.connect(config.debateId);
    }
    
    return adapter;
  } else {
    // PRODUCTION: Console disabled
    // console.log('Using Socket.IO for WebSocket connection');
    // Use traditional Socket.IO
    return await createSocketIO(config.token);
  }
}

/**
 * Helper to check if we're using Supabase Realtime
 */
export function isUsingSupabaseRealtime(): boolean {
  return isVercel() || process.env.NEXT_PUBLIC_USE_SUPABASE_REALTIME === 'true';
}

/**
 * Convert Socket.IO events to Supabase Realtime events
 */
export function setupRealtimeHandlers(socket: RealtimeSocket, handlers: {
  onDebateStarted?: (data: unknown) => void;
  onDebateUpdate?: (state: unknown) => void;
  onSpeechStart?: (data: unknown) => void;
  onSpeechEnd?: (data: unknown) => void;
  onAudioChunk?: (chunk: unknown) => void;
  onCrossfireMessage?: (data: unknown) => void;
  onError?: (error: unknown) => void;
}): void {
  // Common events
  if (handlers.onDebateStarted) {
    socket.on('debateStarted', handlers.onDebateStarted);
  }
  
  if (handlers.onDebateUpdate) {
    socket.on('debateUpdate', handlers.onDebateUpdate);
    socket.on('debate_state_update', handlers.onDebateUpdate); // Supabase format
  }
  
  if (handlers.onSpeechStart) {
    socket.on('speechStart', handlers.onSpeechStart);
  }
  
  if (handlers.onSpeechEnd) {
    socket.on('speechEnd', handlers.onSpeechEnd);
  }
  
  if (handlers.onAudioChunk) {
    socket.on('audioChunk', handlers.onAudioChunk);
  }
  
  if (handlers.onCrossfireMessage) {
    socket.on('crossfire_message', handlers.onCrossfireMessage);
  }
  
  if (handlers.onError) {
    socket.on('error', handlers.onError);
    socket.on('connect_error', handlers.onError);
  }
}

/**
 * Clean up handlers
 */
export function cleanupRealtimeHandlers(socket: RealtimeSocket): void {
  socket.removeAllListeners('debateStarted');
  socket.removeAllListeners('debateUpdate');
  socket.removeAllListeners('debate_state_update');
  socket.removeAllListeners('speechStart');
  socket.removeAllListeners('speechEnd');
  socket.removeAllListeners('audioChunk');
  socket.removeAllListeners('crossfire_message');
  socket.removeAllListeners('error');
  socket.removeAllListeners('connect_error');
}