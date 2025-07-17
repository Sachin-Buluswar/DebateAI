/**
 * Socket.IO Debate Event Adapter
 * Maps between different event naming conventions for compatibility
 */

import { Socket } from 'socket.io';
import { Participant, DebateState } from '@/backend/modules/realtimeDebate/debate-types';
import { socketLogger } from '@/lib/monitoring';

// Extended Participant type for AI configuration
interface ExtendedParticipant extends Participant {
  aiConfig?: {
    model: string;
    personalityId: string;
    voiceId: string;
  };
}

interface DebateJoinPayload {
  debateId: string;
  userId: string;
  topic: string;
  userSide: 'pro' | 'con' | 'PRO' | 'CON';
}

interface DebateMessagePayload {
  debateId: string;
  message: {
    type: string;
    content: string;
    speakerId: string;
    timestamp: number;
  };
}

export class DebateSocketAdapter {
  private socket: Socket;
  private debateId?: string;
  private participants: ExtendedParticipant[] = [];

  constructor(socket: Socket) {
    this.socket = socket;
    this.setupEventHandlers();
  }

  private setupEventHandlers() {
    // Handle join event
    this.socket.on('debate:join', async (payload: DebateJoinPayload) => {
      socketLogger.info('Debate join request', {
        metadata: {
          socketId: this.socket.id,
          debateId: payload.debateId,
          userId: payload.userId
        }
      });

      try {
        // Validate required fields
        if (!payload.debateId || !payload.userId) {
          throw new Error('Missing required fields: debateId and userId are required');
        }

        this.debateId = payload.debateId;
        
        // Create participants list based on join payload
        const userSide = (payload.userSide || 'PRO').toUpperCase() as 'PRO' | 'CON';
        const participants: ExtendedParticipant[] = [
          {
            id: payload.userId,
            name: 'User',
            isAI: false,
            team: userSide,
            role: 'SPEAKER_1'
          },
          {
            id: 'ai-opponent-1',
            name: 'AI Opponent',
            isAI: true,
            team: userSide === 'PRO' ? 'CON' : 'PRO',
            role: 'SPEAKER_1',
            aiConfig: {
              model: 'gpt-4o-mini',
              personalityId: 'confident-debater',
              voiceId: 'EXAVITQu4vr4xnSDxMaL'
            }
          }
        ];

        this.participants = participants;

        // Join socket room
        await this.socket.join(payload.debateId);

        // Emit join confirmation
        this.socket.emit('debate:joined', {
          debateId: payload.debateId,
          userId: payload.userId,
          participants,
          success: true
        });

        // Start the debate using existing handler
        this.socket.emit('startDebate', {
          topic: payload.topic,
          participants
        });

      } catch (error) {
        socketLogger.error('Debate join failed', error as Error);
        this.socket.emit('debate:error', {
          message: 'Failed to join debate',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    // Handle phase change requests
    this.socket.on('debate:requestPhaseChange', (payload: { debateId: string; newPhase: string }) => {
      socketLogger.info('Phase change request', {
        metadata: {
          debateId: payload.debateId,
          newPhase: payload.newPhase
        }
      });

      // Emit phase change to all in room
      if (this.debateId === payload.debateId) {
        this.socket.emit('debate:phaseChange', {
          debateId: payload.debateId,
          phase: payload.newPhase,
          timestamp: Date.now()
        });
      }
    });

    // Handle message sending
    this.socket.on('debate:sendMessage', (payload: DebateMessagePayload) => {
      socketLogger.info('Message received', {
        metadata: {
          debateId: payload.debateId,
          messageType: payload.message.type
        }
      });

      // Broadcast message to room
      if (this.debateId === payload.debateId) {
        this.socket.emit('debate:message', payload.message);
        this.socket.to(payload.debateId).emit('debate:message', payload.message);
      }
    });

    // Handle leave event
    this.socket.on('debate:leave', (payload: { debateId: string; userId: string }) => {
      socketLogger.info('User leaving debate', {
        metadata: {
          debateId: payload.debateId,
          userId: payload.userId
        }
      });

      if (this.debateId === payload.debateId) {
        this.socket.leave(payload.debateId);
        this.debateId = undefined;
        
        // Notify others in room
        this.socket.to(payload.debateId).emit('debate:userLeft', {
          userId: payload.userId,
          timestamp: Date.now()
        });
      }
    });

    // Map existing events to new event names
    this.socket.on('debateStateUpdate', (state: DebateState, mode: string) => {
      // Forward state updates with debate event prefix
      this.socket.emit('debate:stateUpdate', {
        state,
        mode,
        debateId: this.debateId
      });
    });

    // Handle errors with debate prefix
    const originalEmit = this.socket.emit.bind(this.socket);
    this.socket.emit = (event: string, ...args: any[]) => {
      // Intercept error events and add debate prefix
      if (event === 'error' && this.debateId) {
        return originalEmit('debate:error', ...args);
      }
      return originalEmit(event, ...args);
    };
  }

  /**
   * Clean up adapter
   */
  cleanup() {
    // Remove all listeners added by adapter
    this.socket.removeAllListeners('debate:join');
    this.socket.removeAllListeners('debate:requestPhaseChange');
    this.socket.removeAllListeners('debate:sendMessage');
    this.socket.removeAllListeners('debate:leave');
  }
}

/**
 * Initialize debate socket adapter for a connection
 */
export function initializeDebateAdapter(socket: Socket): DebateSocketAdapter {
  return new DebateSocketAdapter(socket);
}