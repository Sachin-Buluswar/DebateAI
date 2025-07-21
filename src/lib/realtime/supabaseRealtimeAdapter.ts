import { RealtimeChannel, RealtimeClient } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabaseClient';
import { EventEmitter } from 'events';
import type { Socket } from 'socket.io-client';
import { 
  Participant, 
  DebateState, 
  DebatePhase 
} from '@/backend/modules/realtimeDebate/debate-types';

/**
 * Adapter that provides Socket.IO-like interface using Supabase Realtime
 * This allows us to keep the existing debate logic while using Supabase's WebSocket infrastructure
 */
export class SupabaseRealtimeAdapter extends EventEmitter {
  private channel: RealtimeChannel | null = null;
  private debateId: string | null = null;
  private userId: string;
  private presence: any = {};
  private connected = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  // Socket.IO compatibility properties
  public id: string;
  public connected$ = false;
  public io = {
    engine: {
      transport: {
        name: 'supabase-realtime'
      }
    }
  };

  constructor(userId: string) {
    super();
    this.userId = userId;
    this.id = `supabase-${userId}-${Date.now()}`;
  }

  /**
   * Connect to a debate room
   */
  async connect(debateId: string): Promise<void> {
    if (this.connected && this.debateId === debateId) {
      return;
    }

    this.debateId = debateId;
    
    // Create channel with debate ID
    this.channel = supabase.channel(`debate:${debateId}`, {
      config: {
        presence: {
          key: this.userId,
        },
      },
    });

    // Set up event listeners
    this.setupChannelListeners();

    // Subscribe to channel
    const status = await this.channel.subscribe();
    
    if (status === 'SUBSCRIBED') {
      this.connected = true;
      this.connected$ = true;
      this.reconnectAttempts = 0;
      
      // Track presence
      await this.channel.track({
        userId: this.userId,
        online_at: new Date().toISOString(),
      });
      
      // Emit connect event for Socket.IO compatibility
      this.emit('connect');
      console.log('Connected to Supabase Realtime for debate:', debateId);
    } else {
      this.handleConnectionError(new Error(`Failed to subscribe: ${status}`));
    }
  }

  /**
   * Set up channel event listeners
   */
  private setupChannelListeners(): void {
    if (!this.channel) return;

    // Handle broadcast events (main debate communication)
    this.channel.on('broadcast', { event: '*' }, (payload) => {
      const { event, payload: data } = payload;
      console.log('Received broadcast:', event, data);
      
      // Emit event with Socket.IO pattern
      this.emit(event, data);
    });

    // Handle presence sync for participant tracking
    this.channel.on('presence', { event: 'sync' }, () => {
      const state = this.channel!.presenceState();
      this.presence = state;
      this.emit('presenceUpdate', state);
    });

    // Handle presence join
    this.channel.on('presence', { event: 'join' }, ({ key, newPresences }) => {
      console.log('User joined:', key, newPresences);
      this.emit('userJoined', { userId: key, data: newPresences });
    });

    // Handle presence leave
    this.channel.on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
      console.log('User left:', key, leftPresences);
      this.emit('userLeft', { userId: key, data: leftPresences });
    });

    // Handle connection state changes
    this.channel.on('system', {}, (payload) => {
      if (payload.extension === 'postgres_changes' && payload.status === 'error') {
        this.handleConnectionError(new Error('Realtime connection error'));
      }
    });
  }

  /**
   * Emit event to all participants (Socket.IO compatibility)
   */
  emit(event: string, data?: any): boolean {
    // Handle local events
    if (event === 'connect' || event === 'disconnect' || event === 'connect_error') {
      return super.emit(event, data);
    }

    // Broadcast to channel
    if (this.channel && this.connected) {
      this.channel.send({
        type: 'broadcast',
        event: event,
        payload: data,
      }).then(() => {
        console.log('Broadcast sent:', event);
      }).catch((error) => {
        console.error('Broadcast failed:', error);
        this.handleConnectionError(error);
      });
    }
    
    // Also emit locally for immediate feedback
    return super.emit(event, data);
  }

  /**
   * Socket.IO compatibility methods
   */
  on(event: string, listener: (...args: any[]) => void): this {
    super.on(event, listener);
    return this;
  }

  off(event: string, listener?: (...args: any[]) => void): this {
    if (listener) {
      super.off(event, listener);
    } else {
      super.removeAllListeners(event);
    }
    return this;
  }

  /**
   * Disconnect from debate room
   */
  async disconnect(): Promise<void> {
    if (this.channel) {
      await this.channel.untrack();
      await this.channel.unsubscribe();
      this.channel = null;
    }
    
    this.connected = false;
    this.connected$ = false;
    this.debateId = null;
    this.presence = {};
    
    this.emit('disconnect', 'client disconnect');
  }

  /**
   * Handle connection errors with retry logic
   */
  private async handleConnectionError(error: Error): Promise<void> {
    console.error('Supabase Realtime error:', error);
    this.connected = false;
    this.connected$ = false;
    
    this.emit('connect_error', error);
    
    // Retry logic
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 10000);
      
      console.log(`Reconnecting in ${delay}ms... (attempt ${this.reconnectAttempts})`);
      this.emit('reconnect_attempt', this.reconnectAttempts);
      
      setTimeout(async () => {
        if (this.debateId) {
          await this.connect(this.debateId);
        }
      }, delay);
    } else {
      this.emit('reconnect_failed');
    }
  }

  /**
   * Get current presence state
   */
  getPresence(): any {
    return this.presence;
  }

  /**
   * Check if specific user is online
   */
  isUserOnline(userId: string): boolean {
    return !!this.presence[userId];
  }

  /**
   * Special handling for crossfire events with low latency
   */
  async sendCrossfireMessage(message: any): Promise<void> {
    if (!this.channel || !this.connected) {
      throw new Error('Not connected to debate channel');
    }

    // Use priority broadcast for crossfire
    await this.channel.send({
      type: 'broadcast',
      event: 'crossfire_message',
      payload: {
        ...message,
        timestamp: Date.now(),
        userId: this.userId,
      },
    });
  }

  /**
   * Update debate state
   */
  async updateDebateState(state: Partial<DebateState>): Promise<void> {
    if (!this.channel || !this.connected) {
      throw new Error('Not connected to debate channel');
    }

    await this.channel.send({
      type: 'broadcast',
      event: 'debate_state_update',
      payload: state,
    });
  }
}

/**
 * Factory function to create Socket.IO-compatible adapter
 */
export function createSupabaseRealtimeSocket(userId: string): SupabaseRealtimeAdapter & Partial<Socket> {
  const adapter = new SupabaseRealtimeAdapter(userId);
  
  // Add Socket.IO compatibility properties
  (adapter as any).connected = () => adapter.connected$;
  (adapter as any).close = () => adapter.disconnect();
  
  return adapter as SupabaseRealtimeAdapter & Partial<Socket>;
}