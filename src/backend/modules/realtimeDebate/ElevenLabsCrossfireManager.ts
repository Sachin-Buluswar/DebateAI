import { env } from '@/shared/env';
import { Participant } from './debate-types';

/**
 * CrossfireSession Interface
 * 
 * Represents an active crossfire debate session with ElevenLabs.
 * Each session maintains its own WebSocket connection for real-time
 * bidirectional audio streaming and transcription.
 * 
 * @property sessionId - Unique identifier (socket.id) for this session
 * @property participants - All debate participants for context
 * @property websocket - Active WebSocket connection to ElevenLabs
 * @property isActive - Whether session is currently running
 * @property audioQueue - Buffer for audio chunks (currently unused)
 */
interface CrossfireSession {
  sessionId: string;
  participants: Participant[];
  websocket: WebSocket | null;
  isActive: boolean;
  audioQueue: ArrayBuffer[];
}

/**
 * ElevenLabsWebSocketEvent Interface
 * 
 * Generic event structure for ElevenLabs WebSocket messages.
 * The 'type' field determines the specific event type and
 * additional fields vary based on the event.
 * 
 * Common event types:
 * - 'ping': Keep-alive mechanism
 * - 'user_transcript': User speech transcribed
 * - 'agent_response': AI agent's text response
 * - 'audio': Audio chunk from AI agent
 * - 'interruption': Conversation flow interrupted
 */
interface ElevenLabsWebSocketEvent {
  type: string;
  [key: string]: unknown;
}

/**
 * ElevenLabsCrossfireManager Class
 * 
 * Orchestrates interactive crossfire debate rounds using ElevenLabs
 * Conversational AI. This enables natural, real-time dialogue between
 * human and AI participants with interruptions and back-and-forth.
 * 
 * Architecture:
 * 1. WebSocket Connection: Establishes secure connection to ElevenLabs
 * 2. Audio Streaming: Bidirectional audio flow (user <-> AI)
 * 3. Real-time Transcription: Captures all spoken dialogue
 * 4. Multi-speaker AI: Single agent represents all AI participants
 * 
 * Key Features:
 * - Low-latency audio streaming (~500ms round-trip)
 * - Natural interruptions and conversational flow
 * - Automatic speaker identification
 * - Context-aware responses based on debate state
 * 
 * Crossfire Rules:
 * - Rapid Q&A between opposing teams
 * - Direct, challenging questions
 * - Concise, pointed answers
 * - All participants can speak
 */
export class ElevenLabsCrossfireManager {
  /**
   * Active crossfire sessions mapped by socket ID.
   * Allows multiple concurrent debates with isolated contexts.
   */
  private sessions: Map<string, CrossfireSession> = new Map();
  
  /**
   * ElevenLabs agent ID for crossfire conversations.
   * Must be configured with appropriate debate personality.
   */
  private agentId: string;

  /**
   * Initialize the crossfire manager.
   * 
   * @param agentId - Optional ElevenLabs agent ID. Falls back to env var.
   */
  constructor(agentId?: string) {
    // Priority: provided ID > environment variable > empty string
    this.agentId = agentId || env.ELEVENLABS_CROSSFIRE_AGENT_ID || '';
  }

  /**
   * Initialize a new crossfire session.
   * 
   * Creates a WebSocket connection to ElevenLabs and configures
   * the AI agent with debate context and personality.
   * 
   * @param sessionId - Unique session identifier (socket.id)
   * @param topic - Debate topic for context
   * @param participants - All debate participants
   * @param onAudioReceived - Callback for AI audio chunks
   * @param onTranscriptReceived - Callback for transcribed text
   * 
   * @throws Error if agent ID not configured or connection fails
   */
  async initializeCrossfireSession(
    sessionId: string,
    topic: string,
    participants: Participant[],
    onAudioReceived: (audio: ArrayBuffer) => void,
    onTranscriptReceived: (speaker: string, text: string) => void
  ): Promise<void> {
    if (this.sessions.has(sessionId)) {
      // PRODUCTION: Console disabled
      // console.warn(`Crossfire session ${sessionId} already exists`);
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

    /**
     * WebSocket Connection Handler
     * 
     * Once connected, sends initialization message with:
     * 1. Custom prompt explaining crossfire rules and context
     * 2. Participant information for proper role-playing
     * 3. Dynamic variables for context injection
     */
    ws.onopen = () => {
      // PRODUCTION: Console disabled
      // console.log(`Crossfire WebSocket connected for session ${sessionId}`);
      session.isActive = true;
      
      // Configure AI agent with debate context
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
            voice_id: null // Uses agent's configured voice
          }
        },
        // Dynamic context for real-time updates
        dynamic_variables: {
          debate_topic: topic,
          participant_names: participants.map(p => p.name).join(', '),
          phase: 'crossfire'
        }
      });
    };

    /**
     * WebSocket Message Handler
     * 
     * Processes various event types from ElevenLabs:
     * - Ping/Pong: Maintains connection health
     * - Transcripts: Captures spoken dialogue
     * - Audio: Streams AI voice responses
     * - Interruptions: Handles conversation flow changes
     */
    ws.onmessage = async (event) => {
      const data = JSON.parse(event.data) as ElevenLabsWebSocketEvent;
      
      switch (data.type) {
        /**
         * Ping Event
         * 
         * ElevenLabs sends periodic pings to check connection health.
         * We must respond with a pong within the specified time.
         */
        case 'ping':
          if (data.ping_event && typeof data.ping_event === 'object' && 'event_id' in data.ping_event && 'ping_ms' in data.ping_event) {
            setTimeout(() => {
              this.sendMessage(ws, {
                type: 'pong',
                event_id: (data.ping_event as { event_id: string }).event_id
              });
            }, (data.ping_event as { ping_ms: number }).ping_ms || 0);
          }
          break;
          
        /**
         * User Transcript Event
         * 
         * Real-time transcription of user's speech.
         * Sent as user speaks into microphone.
         */
        case 'user_transcript':
          if (data.user_transcription_event && typeof data.user_transcription_event === 'object' && 'user_transcript' in data.user_transcription_event) {
            const userTranscript = (data.user_transcription_event as { user_transcript: string }).user_transcript;
            if (userTranscript) {
              onTranscriptReceived('User', userTranscript);
            }
          }
          break;
          
        /**
         * Agent Response Event
         * 
         * Text of AI agent's response. The agent represents all
         * AI participants, so we parse the response to identify
         * which character is speaking.
         */
        case 'agent_response':
          if (data.agent_response_event && typeof data.agent_response_event === 'object' && 'agent_response' in data.agent_response_event) {
            const agentResponse = (data.agent_response_event as { agent_response: string }).agent_response;
            if (agentResponse) {
              // Parse speaker from response format "Name: dialogue"
              const speaker = this.identifySpeaker(agentResponse, participants);
              onTranscriptReceived(speaker, agentResponse);
            }
          }
          break;
          
        /**
         * Audio Event
         * 
         * Chunks of AI-generated speech audio.
         * Arrives as base64-encoded audio data that needs
         * conversion before playback.
         */
        case 'audio':
          if (data.audio_event && typeof data.audio_event === 'object' && 'audio_base_64' in data.audio_event) {
            const audioBase64 = (data.audio_event as { audio_base_64: string }).audio_base_64;
            if (audioBase64) {
              // Convert for audio playback
              const audioBuffer = this.base64ToArrayBuffer(audioBase64);
              onAudioReceived(audioBuffer);
            }
          }
          break;
          
        /**
         * Interruption Event
         * 
         * Indicates conversation flow was interrupted.
         * Common reasons:
         * - User started speaking while AI was talking
         * - Network issues caused audio gap
         * - Explicit interruption command
         */
        case 'interruption':
          if (data.interruption_event && typeof data.interruption_event === 'object' && 'reason' in data.interruption_event) {
            // PRODUCTION: Console disabled
            // console.log('Interruption detected:', (data.interruption_event as { reason: string }).reason);
          }
          break;
      }
    };

    ws.onerror = (_error) => {
      // PRODUCTION: Console disabled
      // console.error(`Crossfire WebSocket error for session ${sessionId}:`, _error);
    };

    ws.onclose = () => {
      // PRODUCTION: Console disabled
      // console.log(`Crossfire WebSocket closed for session ${sessionId}`);
      session.isActive = false;
      this.sessions.delete(sessionId);
    };

    this.sessions.set(sessionId, session);
  }

  /**
   * Send user audio to ElevenLabs.
   * 
   * Forwards microphone audio from the user to the AI agent
   * for real-time processing. Audio must be converted to base64
   * for WebSocket transmission.
   * 
   * Expected audio format:
   * - Sample rate: 16kHz or higher
   * - Encoding: PCM16 or similar
   * - Chunks: 20-100ms for optimal latency
   * 
   * @param sessionId - Active session identifier
   * @param audioData - Raw audio buffer from microphone
   */
  sendUserAudio(sessionId: string, audioData: ArrayBuffer): void {
    const session = this.sessions.get(sessionId);
    if (!session || !session.websocket || session.websocket.readyState !== WebSocket.OPEN) {
      // PRODUCTION: Console disabled
      // console.warn(`Cannot send audio - session ${sessionId} not active`);
      return;
    }

    // ElevenLabs expects base64-encoded audio
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
    // PRODUCTION: Console disabled
    // console.log(`Crossfire session ${sessionId} ended`);
  }

  /**
   * Get signed WebSocket URL from ElevenLabs.
   * 
   * Security mechanism that provides temporary, authenticated
   * WebSocket endpoints. URLs expire after a short time to
   * prevent unauthorized access.
   * 
   * @returns Signed WebSocket URL for secure connection
   * @throws Error if API key invalid or agent not found
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
   * Generate crossfire prompt for AI agent.
   * 
   * Creates a detailed system prompt that:
   * 1. Explains crossfire debate format and rules
   * 2. Lists all participants with roles
   * 3. Instructs agent to role-play multiple AI speakers
   * 4. Sets tone for challenging but respectful dialogue
   * 
   * The agent uses this context to generate appropriate
   * questions and responses for each AI participant.
   * 
   * @param topic - Debate topic for context
   * @param participants - All participants for role assignment
   * @returns Formatted system prompt
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
   * Parse speaker identity from AI response.
   * 
   * The AI agent is instructed to prefix responses with
   * "SpeakerName: " to indicate which participant is speaking.
   * This method extracts the speaker name from that format.
   * 
   * @param response - Full AI response text
   * @param participants - List of participants to match against
   * @returns Identified speaker name or default
   */
  private identifySpeaker(response: string, participants: Participant[]): string {
    // Look for "Name:" pattern at start of response
    for (const participant of participants) {
      if (response.startsWith(participant.name + ':')) {
        return participant.name;
      }
    }
    
    // Fallback if pattern not found
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