/**
 * ElevenLabs WebSocket Service - Real-time text-to-speech streaming
 * 
 * This service provides low-latency voice synthesis for the debate system
 * using ElevenLabs' WebSocket API. It's the primary voice generation method
 * for real-time debate interactions.
 * 
 * Role in the System:
 * - Powers the AI debate agents' voices with distinct personalities
 * - Provides real-time streaming for immediate audio feedback
 * - Handles network interruptions with automatic reconnection
 * - Manages voice settings based on speaker personality and difficulty
 * 
 * Key Features:
 * - WebSocket-based streaming for minimal latency (~100ms)
 * - Automatic reconnection with exponential backoff
 * - Message queueing during disconnections
 * - Per-speaker voice customization
 * - Difficulty-based speaking speed adjustment
 * 
 * Authentication:
 * - API key passed via query parameter (xi_api_key)
 * - Managed through environment variable ELEVENLABS_API_KEY
 */

import WebSocket from 'ws';
import { env } from '@/shared/env';
import { debateConfig } from '@/backend/modules/realtimeDebate/debate.config';
import { servicesConfig } from '@/backend/config/services.config';
import { DifficultyLevel } from '@/backend/modules/realtimeDebate/types';
import { globalErrorRecovery } from '@/lib/errorRecovery';

/**
 * Configuration for ElevenLabs WebSocket connection
 * Each parameter affects the voice synthesis quality and latency
 */
interface ElevenLabsWebSocketConfig {
  voiceId: string; // Unique identifier for the voice to use
  modelId?: string; // TTS model (eleven_turbo_v2 for low latency)
  voiceSettings?: {
    stability?: number; // 0-1: Voice consistency vs expressiveness
    similarity_boost?: number; // 0-1: How closely to match original voice
    style?: number; // 0-1: Style exaggeration (also affects speaking pace)
    use_speaker_boost?: boolean; // Enhanced voice clarity
  };
  outputFormat?: string; // Audio format (mp3_44100_128 for quality/size balance)
  optimizeStreamingLatency?: number; // 0-4: Lower = better latency, higher = better quality
}

interface WebSocketMessage {
  text: string;
  voice_settings?: ElevenLabsWebSocketConfig['voiceSettings'];
  flush?: boolean;
}

interface AudioChunkCallback {
  (chunk: Buffer): void;
}

interface ErrorCallback {
  (error: Error): void;
}

/**
 * ElevenLabsWebSocketService - Manages WebSocket connections for streaming TTS
 * 
 * This class handles the complete lifecycle of a WebSocket connection:
 * 1. Connection establishment with authentication
 * 2. Message sending with automatic queueing
 * 3. Audio chunk reception and processing
 * 4. Error handling and automatic reconnection
 * 5. Graceful shutdown and cleanup
 * 
 * The service is designed for resilience in production environments
 * where network interruptions may occur during live debates.
 */
export class ElevenLabsWebSocketService {
  private ws: WebSocket | null = null;
  private config: ElevenLabsWebSocketConfig;
  private onAudioChunk: AudioChunkCallback | null = null;
  private onError: ErrorCallback | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 3; // Limits reconnection attempts to prevent infinite loops
  private isConnected = false;
  private messageQueue: WebSocketMessage[] = []; // Stores messages during disconnection

  constructor(config: ElevenLabsWebSocketConfig) {
    this.config = {
      modelId: servicesConfig.elevenLabs.ttsModelId,
      outputFormat: 'mp3_44100_128',
      optimizeStreamingLatency: servicesConfig.elevenLabs.latencyOptimization,
      ...config
    };
  }

  /**
   * Connect to ElevenLabs WebSocket API
   * 
   * Establishes a WebSocket connection with comprehensive error handling:
   * - Connection timeout after 10 seconds
   * - Automatic message queue flushing on successful connection
   * - Error recovery with exponential backoff
   * - Detailed logging for debugging production issues
   * 
   * The connection process is wrapped in globalErrorRecovery for:
   * - Automatic retry on transient failures
   * - Consistent error handling across the application
   * - Metrics collection for monitoring
   */
  async connect(): Promise<void> {
    return globalErrorRecovery.executeWithRecovery(
      'elevenlabs-websocket-connect',
      async () => {
        const wsUrl = this.buildWebSocketUrl();
        
        this.ws = new WebSocket(wsUrl);
        
        return new Promise<void>((resolve, reject) => {
          if (!this.ws) {
            reject(new Error('WebSocket instance not created'));
            return;
          }

          const connectionTimeout = setTimeout(() => {
            if (this.ws) {
              this.ws.close();
            }
            reject(new Error('WebSocket connection timeout'));
          }, 10000);

          this.ws.on('open', () => {
            clearTimeout(connectionTimeout);
            console.log('ElevenLabs WebSocket connected');
            this.isConnected = true;
            this.reconnectAttempts = 0;
            
            // Send any queued messages
            this.flushMessageQueue();
            
            resolve();
          });

          this.ws.on('message', (data: Buffer) => {
            try {
              // ElevenLabs sends both JSON messages and binary audio data
              // JSON messages include:
              // - Error notifications
              // - Word-level alignment data (for subtitle generation)
              // - Stream status updates
              const textData = data.toString();
              if (textData.startsWith('{')) {
                const message = JSON.parse(textData);
                
                if (message.error) {
                  console.error('ElevenLabs WebSocket error:', message);
                  if (this.onError) {
                    this.onError(new Error(message.error));
                  }
                  return;
                }
                
                // Handle other JSON messages (like alignment data)
                // These could be used for:
                // - Synchronized subtitles
                // - Progress tracking
                // - Pronunciation timing
                console.log('ElevenLabs WebSocket message:', message);
              } else {
                // Binary audio data (MP3 chunks)
                // These arrive in small chunks for low latency
                if (this.onAudioChunk) {
                  this.onAudioChunk(data);
                }
              }
            } catch (error) {
              // If parsing fails, assume it's audio data
              // This handles edge cases where JSON detection fails
              if (this.onAudioChunk) {
                this.onAudioChunk(data);
              }
            }
          });

          this.ws.on('error', (error) => {
            clearTimeout(connectionTimeout);
            console.error('ElevenLabs WebSocket error:', error);
            this.isConnected = false;
            
            if (this.onError) {
              this.onError(error);
            }
            
            reject(error);
          });

          this.ws.on('close', (code, reason) => {
            console.log(`ElevenLabs WebSocket closed: ${code} - ${reason}`);
            this.isConnected = false;
            
            // WebSocket close codes:
            // 1000: Normal closure (user-initiated)
            // 1001: Going away (server shutdown)
            // 1006: Abnormal closure (network error)
            // 1008: Policy violation (auth failure)
            // 1011: Server error
            
            // Attempt reconnection if not a normal closure
            // This ensures continuity during network hiccups
            if (code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
              this.attemptReconnect();
            }
          });
        });
      },
      {
        retryOptions: {
          maxRetries: 3,
          onRetry: (error, attempt) => {
            console.warn(`ElevenLabs WebSocket connection retry ${attempt}:`, error.message);
          }
        }
      }
    );
  }

  /**
   * Send text to be converted to speech
   * 
   * Converts text to speech with streaming audio output.
   * Key features:
   * - Automatic queueing if disconnected
   * - Reconnection attempts if needed
   * - Voice settings applied per message
   * - Flush parameter for immediate processing
   * 
   * @param text - The text to convert to speech
   * @param flush - If true, processes immediately without buffering
   *                Used at the end of sentences for natural pauses
   * 
   * The service maintains a message queue to ensure no text is lost
   * during temporary disconnections, critical for debate continuity.
   */
  async sendText(text: string, flush = false): Promise<void> {
    const message: WebSocketMessage = {
      text,
      voice_settings: this.config.voiceSettings,
      flush
    };

    if (!this.isConnected || !this.ws) {
      // Queue the message
      this.messageQueue.push(message);
      
      // Try to reconnect if not already connected
      if (!this.isConnected) {
        await this.connect();
      }
      return;
    }

    return globalErrorRecovery.executeWithRecovery(
      'elevenlabs-websocket-send',
      async () => {
        if (!this.ws) {
          throw new Error('WebSocket not connected');
        }

        this.ws.send(JSON.stringify(message));
      },
      {
        retryOptions: {
          maxRetries: 2,
          shouldRetry: (error) => {
            // Don't retry if WebSocket is closing or closed
            if (this.ws?.readyState === WebSocket.CLOSING || 
                this.ws?.readyState === WebSocket.CLOSED) {
              return false;
            }
            return true;
          }
        }
      }
    );
  }

  /**
   * Close the WebSocket connection
   */
  close(): void {
    if (this.ws) {
      this.isConnected = false;
      this.ws.close(1000, 'Normal closure');
      this.ws = null;
    }
  }

  /**
   * Set callback for audio chunks
   */
  onAudioData(callback: AudioChunkCallback): void {
    this.onAudioChunk = callback;
  }

  /**
   * Set callback for errors
   */
  onErrorEvent(callback: ErrorCallback): void {
    this.onError = callback;
  }

  /**
   * Get connection status
   */
  isConnectedStatus(): boolean {
    return this.isConnected && this.ws?.readyState === WebSocket.OPEN;
  }

  /**
   * Build WebSocket URL with authentication and configuration
   * 
   * Constructs the complete WebSocket URL including:
   * - Voice ID in the path
   * - API key for authentication
   * - Model selection for quality/latency trade-off
   * - Output format for compatibility
   * - Latency optimization setting
   * 
   * URL structure:
   * wss://api.elevenlabs.io/v1/text-to-speech/{voice_id}/stream-input
   * 
   * Query parameters:
   * - xi_api_key: Authentication
   * - model_id: eleven_turbo_v2 for low latency
   * - output_format: mp3_44100_128 for quality/size balance
   * - optimize_streaming_latency: 0-4 scale (3 = balanced)
   */
  private buildWebSocketUrl(): string {
    const baseUrl = 'wss://api.elevenlabs.io/v1/text-to-speech';
    const params = new URLSearchParams({
      model_id: this.config.modelId || servicesConfig.elevenLabs.ttsModelId,
      output_format: this.config.outputFormat || 'mp3_44100_128',
      optimize_streaming_latency: String(this.config.optimizeStreamingLatency || 3),
      xi_api_key: env.ELEVENLABS_API_KEY
    });

    return `${baseUrl}/${this.config.voiceId}/stream-input?${params.toString()}`;
  }

  /**
   * Attempt to reconnect after disconnection
   * 
   * Implements exponential backoff strategy:
   * - First retry: 1 second
   * - Second retry: 2 seconds
   * - Third retry: 4 seconds
   * - Max delay: 10 seconds
   * 
   * This strategy balances:
   * - Quick recovery from transient issues
   * - Avoiding server overload
   * - Respecting rate limits
   * 
   * Failed reconnections don't throw errors to prevent
   * cascading failures in the debate system.
   */
  private async attemptReconnect(): Promise<void> {
    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 10000);
    
    console.log(`Attempting to reconnect ElevenLabs WebSocket in ${delay}ms...`);
    
    setTimeout(async () => {
      try {
        await this.connect();
      } catch (error) {
        console.error('ElevenLabs WebSocket reconnection failed:', error);
      }
    }, delay);
  }

  /**
   * Send any queued messages after reconnection
   * 
   * Processes the message queue in FIFO order to maintain
   * the correct sequence of speech. This is critical for:
   * - Preserving debate argument flow
   * - Maintaining context between sentences
   * - Ensuring no content is lost
   * 
   * If sending fails:
   * - The message is returned to the front of the queue
   * - Processing stops to prevent out-of-order delivery
   * - The queue will be retried on next connection
   */
  private async flushMessageQueue(): Promise<void> {
    while (this.messageQueue.length > 0 && this.isConnected) {
      const message = this.messageQueue.shift();
      if (message) {
        try {
          await this.sendText(message.text, message.flush);
        } catch (error) {
          console.error('Failed to send queued message:', error);
          // Put it back at the front of the queue
          this.messageQueue.unshift(message);
          break;
        }
      }
    }
  }
}

/**
 * Create a WebSocket connection for a specific speaker
 * 
 * Factory function that creates a configured WebSocket service
 * based on the speaker's personality and difficulty level.
 * 
 * Speaker personality affects:
 * - Voice selection (each debater has a unique voice)
 * - Stability (consistency vs expressiveness)
 * - Similarity boost (voice matching accuracy)
 * - Style (speaking characteristics)
 * 
 * Difficulty level affects:
 * - Speaking speed (via style parameter)
 * - Beginner: 0.8x speed for easier comprehension
 * - Intermediate: 1.0x normal speed
 * - Expert: 1.2x faster for advanced users
 * 
 * This customization creates distinct, recognizable voices
 * for each AI debater while adapting to user skill level.
 */
export async function createElevenLabsWebSocketForSpeaker(
  speakerName: string,
  difficulty: DifficultyLevel = 'intermediate'
): Promise<ElevenLabsWebSocketService> {
  const personality = debateConfig.personalities[speakerName] || null;
  const voiceId = personality ? personality.voiceId : servicesConfig.elevenLabs.narratorVoiceId;
  const difficultyConfig = debateConfig.difficultyLevels[difficulty];
  
  // Apply difficulty-based speaking speed to voice settings
  const baseVoiceSettings = personality ? personality.settings : { stability: 0.5, similarity_boost: 0.75 };
  const voiceSettings = {
    ...baseVoiceSettings,
    // Adjust style to affect pace based on difficulty
    style: baseVoiceSettings.style ? baseVoiceSettings.style * difficultyConfig.speakingSpeed : 0.3 * difficultyConfig.speakingSpeed
  };

  const service = new ElevenLabsWebSocketService({
    voiceId,
    voiceSettings
  });

  return service;
}