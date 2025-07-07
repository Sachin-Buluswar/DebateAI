import { env } from '@/shared/env';
import { Participant } from './debate-types';

interface CrossfireSession {
  sessionId: string;
  participants: Participant[];
  websocket: WebSocket | null;
  isActive: boolean;
  audioQueue: ArrayBuffer[];
}

interface ElevenLabsWebSocketEvent {
  type: string;
  [key: string]: unknown;
}

/**
 * Manages ElevenLabs Conversational AI WebSocket connections for crossfire sessions
 * This enables real-time, multi-speaker conversations with low latency
 */
export class ElevenLabsCrossfireManager {
  private sessions: Map<string, CrossfireSession> = new Map();
  private agentId: string;

  constructor(agentId?: string) {
    // Use a default agent ID or require one to be configured
    this.agentId = agentId || env.ELEVENLABS_CROSSFIRE_AGENT_ID || '';
  }

  /**
   * Initialize a crossfire session with ElevenLabs Conversational AI
   */
  async initializeCrossfireSession(
    sessionId: string,
    topic: string,
    participants: Participant[],
    onAudioReceived: (audio: ArrayBuffer) => void,
    onTranscriptReceived: (speaker: string, text: string) => void
  ): Promise<void> {
    if (this.sessions.has(sessionId)) {
      console.warn(`Crossfire session ${sessionId} already exists`);
      return;
    }

    // Get signed URL for secure WebSocket connection
    const signedUrl = await this.getSignedUrl();
    
    // Create WebSocket connection
    const ws = new WebSocket(signedUrl);
    
    const session: CrossfireSession = {
      sessionId,
      participants,
      websocket: ws,
      isActive: false,
      audioQueue: []
    };

    // Set up WebSocket event handlers
    ws.onopen = () => {
      console.log(`Crossfire WebSocket connected for session ${sessionId}`);
      session.isActive = true;
      
      // Send initialization data with debate context
      this.sendMessage(ws, {
        type: 'conversation_initiation_client_data',
        conversation_config_override: {
          agent: {
            prompt: {
              prompt: this.generateCrossfirePrompt(topic, participants)
            },
            first_message: "Let's begin the crossfire round. Who would like to start?",
            language: 'en'
          },
          tts: {
            voice_id: null // Will use agent's default voice
          }
        },
        dynamic_variables: {
          debate_topic: topic,
          participant_names: participants.map(p => p.name).join(', '),
          phase: 'crossfire'
        }
      });
    };

    ws.onmessage = async (event) => {
      const data = JSON.parse(event.data) as ElevenLabsWebSocketEvent;
      
      switch (data.type) {
        case 'ping':
          // Keep connection alive
          if (data.ping_event && typeof data.ping_event === 'object' && 'event_id' in data.ping_event && 'ping_ms' in data.ping_event) {
            setTimeout(() => {
              this.sendMessage(ws, {
                type: 'pong',
                event_id: (data.ping_event as { event_id: string }).event_id
              });
            }, (data.ping_event as { ping_ms: number }).ping_ms || 0);
          }
          break;
          
        case 'user_transcript':
          // User speech transcribed
          if (data.user_transcription_event && typeof data.user_transcription_event === 'object' && 'user_transcript' in data.user_transcription_event) {
            const userTranscript = (data.user_transcription_event as { user_transcript: string }).user_transcript;
            if (userTranscript) {
              onTranscriptReceived('User', userTranscript);
            }
          }
          break;
          
        case 'agent_response':
          // AI agent response text
          if (data.agent_response_event && typeof data.agent_response_event === 'object' && 'agent_response' in data.agent_response_event) {
            const agentResponse = (data.agent_response_event as { agent_response: string }).agent_response;
            if (agentResponse) {
              // Determine which AI speaker this is based on response content
              const speaker = this.identifySpeaker(agentResponse, participants);
              onTranscriptReceived(speaker, agentResponse);
            }
          }
          break;
          
        case 'audio':
          // Audio chunk received
          if (data.audio_event && typeof data.audio_event === 'object' && 'audio_base_64' in data.audio_event) {
            const audioBase64 = (data.audio_event as { audio_base_64: string }).audio_base_64;
            if (audioBase64) {
              // Convert base64 to ArrayBuffer
              const audioBuffer = this.base64ToArrayBuffer(audioBase64);
              onAudioReceived(audioBuffer);
            }
          }
          break;
          
        case 'interruption':
          if (data.interruption_event && typeof data.interruption_event === 'object' && 'reason' in data.interruption_event) {
            console.log('Interruption detected:', (data.interruption_event as { reason: string }).reason);
          }
          break;
      }
    };

    ws.onerror = (error) => {
      console.error(`Crossfire WebSocket error for session ${sessionId}:`, error);
    };

    ws.onclose = () => {
      console.log(`Crossfire WebSocket closed for session ${sessionId}`);
      session.isActive = false;
      this.sessions.delete(sessionId);
    };

    this.sessions.set(sessionId, session);
  }

  /**
   * Send user audio to the crossfire session
   */
  sendUserAudio(sessionId: string, audioData: ArrayBuffer): void {
    const session = this.sessions.get(sessionId);
    if (!session || !session.websocket || session.websocket.readyState !== WebSocket.OPEN) {
      console.warn(`Cannot send audio - session ${sessionId} not active`);
      return;
    }

    // Convert ArrayBuffer to base64
    const base64Audio = this.arrayBufferToBase64(audioData);
    
    this.sendMessage(session.websocket, {
      user_audio_chunk: base64Audio
    });
  }

  /**
   * Send contextual update without interrupting conversation
   */
  sendContextualUpdate(sessionId: string, context: string): void {
    const session = this.sessions.get(sessionId);
    if (!session || !session.websocket) return;

    this.sendMessage(session.websocket, {
      type: 'contextual_update',
      text: context
    });
  }

  /**
   * End the crossfire session
   */
  endCrossfireSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    if (session.websocket) {
      session.websocket.close();
    }
    
    this.sessions.delete(sessionId);
    console.log(`Crossfire session ${sessionId} ended`);
  }

  /**
   * Get signed URL for WebSocket connection
   */
  private async getSignedUrl(): Promise<string> {
    const response = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=${this.agentId}`,
      {
        method: 'GET',
        headers: {
          'xi-api-key': env.ELEVENLABS_API_KEY
        }
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to get signed URL: ${response.statusText}`);
    }

    const data = await response.json();
    return data.signed_url;
  }

  /**
   * Generate a prompt for the crossfire AI agent
   */
  private generateCrossfirePrompt(topic: string, participants: Participant[]): string {
    const aiParticipants = participants.filter(p => p.isAI);
    
    return `You are moderating a crossfire debate session on the topic: "${topic}"

PARTICIPANTS:
${participants.map(p => `- ${p.name} (${p.team} team, ${p.isAI ? 'AI' : 'Human'})`).join('\n')}

CROSSFIRE RULES:
1. This is a rapid-fire Q&A session between opposing teams
2. Questions should be direct and challenging
3. Answers should be concise and to the point
4. Allow natural back-and-forth between participants
5. Ensure all participants get a chance to speak
6. Keep the discussion focused on the debate topic

YOUR ROLE:
- You represent ALL AI participants (${aiParticipants.map(p => p.name).join(', ')})
- Speak as each AI participant when it's their turn
- Start responses with the speaker's name, e.g., "Emily Carter: I'd like to ask..."
- Maintain each AI participant's personality and debate position
- Respond to questions from human participants as the appropriate AI debater
- Ask probing questions to human participants

The crossfire session has begun. Facilitate an engaging discussion!`;
  }

  /**
   * Send a message through the WebSocket
   */
  private sendMessage(websocket: WebSocket, message: object): void {
    if (websocket.readyState === WebSocket.OPEN) {
      websocket.send(JSON.stringify(message));
    }
  }

  /**
   * Identify which AI speaker based on response content
   */
  private identifySpeaker(response: string, participants: Participant[]): string {
    // Check if response starts with a participant name
    for (const participant of participants) {
      if (response.startsWith(participant.name + ':')) {
        return participant.name;
      }
    }
    
    // Default to first AI participant if no name prefix found
    const firstAI = participants.find(p => p.isAI);
    return firstAI?.name || 'AI Speaker';
  }

  /**
   * Convert base64 string to ArrayBuffer
   */
  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  }

  /**
   * Convert ArrayBuffer to base64 string
   */
  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  /**
   * Check if a session is active
   */
  isSessionActive(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    return session?.isActive || false;
  }
} 