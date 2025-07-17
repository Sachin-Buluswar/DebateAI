import WebSocket from 'ws';
import { env } from '@/shared/env';
import { debateConfig } from '@/backend/modules/realtimeDebate/debate.config';
import { servicesConfig } from '@/backend/config/services.config';
import { DifficultyLevel } from '@/backend/modules/realtimeDebate/types';
import { globalErrorRecovery } from '@/lib/errorRecovery';

interface ElevenLabsWebSocketConfig {
  voiceId: string;
  modelId?: string;
  voiceSettings?: {
    stability?: number;
    similarity_boost?: number;
    style?: number;
    use_speaker_boost?: boolean;
  };
  outputFormat?: string;
  optimizeStreamingLatency?: number;
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

export class ElevenLabsWebSocketService {
  private ws: WebSocket | null = null;
  private config: ElevenLabsWebSocketConfig;
  private onAudioChunk: AudioChunkCallback | null = null;
  private onError: ErrorCallback | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 3;
  private isConnected = false;
  private messageQueue: WebSocketMessage[] = [];

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
              // Check if it's a JSON message
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
                console.log('ElevenLabs WebSocket message:', message);
              } else {
                // It's audio data
                if (this.onAudioChunk) {
                  this.onAudioChunk(data);
                }
              }
            } catch (error) {
              // If parsing fails, assume it's audio data
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
            
            // Attempt reconnection if not a normal closure
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
   * Build WebSocket URL with authentication
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
   * Send any queued messages
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