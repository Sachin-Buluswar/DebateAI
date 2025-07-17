import fetch from 'node-fetch';
import { env } from '@/shared/env';
import type { Response } from 'node-fetch';
import { debateConfig } from '@/backend/modules/realtimeDebate/debate.config';
import { servicesConfig } from '@/backend/config/services.config';
import { DifficultyLevel } from '@/backend/modules/realtimeDebate/types';
import { globalErrorRecovery } from '@/lib/errorRecovery';
import { ElevenLabsWebSocketService, createElevenLabsWebSocketForSpeaker } from './elevenLabsWebSocket';

/**
 * Generates a readable audio stream from text using the ElevenLabs API.
 * @param text The text to convert to speech.
 * @param speakerName Optional speaker name to select appropriate voice profile
 * @param difficulty Optional difficulty level affecting speaking speed
 * @returns A Promise that resolves to the full Response object, or null on failure.
 */
export async function generateAudioStreamResponse(text: string, speakerName?: string, difficulty: DifficultyLevel = 'intermediate'): Promise<Response | null> {
    try {
        const personality = debateConfig.personalities[speakerName || ''] || null;
        const voiceId = personality ? personality.voiceId : servicesConfig.elevenLabs.narratorVoiceId;
        const difficultyConfig = debateConfig.difficultyLevels[difficulty];
        
        // Apply difficulty-based speaking speed to voice settings
        const baseVoiceSettings = personality ? personality.settings : { stability: 0.5, similarity_boost: 0.75 };
        const voiceSettings = {
            ...baseVoiceSettings,
            // ElevenLabs doesn't have a direct speed parameter, but we can adjust style to affect pace
            style: baseVoiceSettings.style ? baseVoiceSettings.style * difficultyConfig.speakingSpeed : 0.3 * difficultyConfig.speakingSpeed
        };

        // Execute with comprehensive error recovery
        const response = await globalErrorRecovery.executeWithRecovery(
            'elevenlabs-tts',
            async () => {
                const res = await fetch(
                    `${servicesConfig.elevenLabs.apiBaseUrl}/text-to-speech/${voiceId}/stream?optimize_streaming_latency=${servicesConfig.elevenLabs.latencyOptimization}`,
                    {
                        method: 'POST',
                        headers: {
                            'Accept': 'audio/mpeg',
                            'Content-Type': 'application/json',
                            'xi-api-key': env.ELEVENLABS_API_KEY,
                        },
                        body: JSON.stringify({
                            text: text,
                            model_id: servicesConfig.elevenLabs.ttsModelId,
                            voice_settings: voiceSettings,
                        }),
                    }
                );

                if (!res.ok) {
                    const errorData = await res.json();
                    console.error('ElevenLabs API Error:', errorData);
                    
                    // Create error with status for retry logic
                    const error = new Error(`ElevenLabs TTS failed: ${errorData.detail?.message || 'Unknown error'}`);
                    (error as any).status = res.status;
                    throw error;
                }

                return res;
            },
            {
                retryOptions: {
                    maxRetries: 3,
                    onRetry: (error, attempt) => {
                        console.warn(`ElevenLabs TTS retry attempt ${attempt}:`, error.message);
                    },
                    shouldRetry: (error) => {
                        // Don't retry on authentication errors
                        if ((error as any).status === 401) return false;
                        // Don't retry on invalid input
                        if ((error as any).status === 400) return false;
                        return true;
                    }
                },
                fallbacks: [
                    // Fallback to a different voice if the specified one fails
                    async () => {
                        console.warn(`Falling back to narrator voice for TTS`);
                        const fallbackResponse = await fetch(
                            `${servicesConfig.elevenLabs.apiBaseUrl}/text-to-speech/${servicesConfig.elevenLabs.narratorVoiceId}/stream?optimize_streaming_latency=${servicesConfig.elevenLabs.latencyOptimization}`,
                            {
                                method: 'POST',
                                headers: {
                                    'Accept': 'audio/mpeg',
                                    'Content-Type': 'application/json',
                                    'xi-api-key': env.ELEVENLABS_API_KEY,
                                },
                                body: JSON.stringify({
                                    text: text,
                                    model_id: servicesConfig.elevenLabs.ttsModelId,
                                    voice_settings: { stability: 0.5, similarity_boost: 0.75 },
                                }),
                            }
                        );
                        
                        if (!fallbackResponse.ok) {
                            throw new Error('Fallback voice also failed');
                        }
                        
                        return fallbackResponse;
                    }
                ]
            }
        );

        return response;
    } catch (error) {
        console.error('Error generating audio stream after all recovery attempts:', error);
        return null;
    }
}

/**
 * Helper that wraps generateAudioStreamResponse and returns a single ArrayBuffer
 * containing the entire MP3 audio for easier transport to the client.
 * @param text The text to convert to speech.
 * @param speakerName Optional speaker name to select appropriate voice profile
 * @param difficulty Optional difficulty level affecting speaking speed
 */
export async function generateAudioArrayBuffer(text: string, speakerName?: string, difficulty: DifficultyLevel = 'intermediate'): Promise<ArrayBuffer | null> {
    const response = await generateAudioStreamResponse(text, speakerName, difficulty);
    if (response?.body) {
        return await response.arrayBuffer();
    }
    return null;
}

/**
 * Generates audio using WebSocket streaming for lower latency
 * @param text The text to convert to speech
 * @param speakerName Optional speaker name to select appropriate voice profile
 * @param difficulty Optional difficulty level affecting speaking speed
 * @param onAudioChunk Callback for each audio chunk received
 * @returns Promise that resolves when streaming is complete
 */
export async function generateAudioStreamWebSocket(
    text: string,
    speakerName?: string,
    difficulty: DifficultyLevel = 'intermediate',
    onAudioChunk?: (chunk: Buffer) => void
): Promise<void> {
    let wsService: ElevenLabsWebSocketService | null = null;
    
    try {
        // Create WebSocket service for the speaker
        wsService = await createElevenLabsWebSocketForSpeaker(speakerName || '', difficulty);
        
        // Set up audio chunk handler
        const chunks: Buffer[] = [];
        
        wsService.onAudioData((chunk) => {
            chunks.push(chunk);
            if (onAudioChunk) {
                onAudioChunk(chunk);
            }
        });
        
        // Set up error handler
        let streamError: Error | null = null;
        wsService.onErrorEvent((error) => {
            console.error('WebSocket streaming error:', error);
            streamError = error;
        });
        
        // Connect to WebSocket
        await wsService.connect();
        
        // Send text for conversion
        await wsService.sendText(text, true); // flush=true to get all audio
        
        // Wait for streaming to complete (with timeout)
        return new Promise((resolve, reject) => {
            let resolved = false;
            
            // Set a timeout for the streaming
            const timeout = setTimeout(() => {
                if (!resolved) {
                    resolved = true;
                    if (wsService) {
                        wsService.close();
                    }
                    reject(new Error('WebSocket streaming timeout'));
                }
            }, 30000); // 30 second timeout
            
            // Check periodically if streaming is complete
            const checkInterval = setInterval(() => {
                if (streamError) {
                    clearInterval(checkInterval);
                    clearTimeout(timeout);
                    if (!resolved) {
                        resolved = true;
                        if (wsService) {
                            wsService.close();
                        }
                        reject(streamError);
                    }
                }
                
                // Simple heuristic: if no new chunks for 2 seconds, assume complete
                // In production, ElevenLabs would send an end-of-stream signal
                const lastChunkTime = chunks.length > 0 ? Date.now() : 0;
                if (lastChunkTime && Date.now() - lastChunkTime > 2000) {
                    clearInterval(checkInterval);
                    clearTimeout(timeout);
                    if (!resolved) {
                        resolved = true;
                        if (wsService) {
                            wsService.close();
                        }
                        resolve();
                    }
                }
            }, 100);
        });
    } catch (error) {
        console.error('Error in WebSocket audio generation:', error);
        throw error;
    } finally {
        // Clean up WebSocket connection
        if (wsService) {
            wsService.close();
        }
    }
}

/**
 * Determines whether to use WebSocket or HTTP streaming based on configuration
 * @param preferWebSocket Whether to prefer WebSocket streaming when available
 * @returns Boolean indicating if WebSocket should be used
 */
export function shouldUseWebSocket(preferWebSocket = true): boolean {
    // For now, default to HTTP until WebSocket is fully tested
    // In production, this can be controlled by environment variable
    const webSocketEnabled = process.env.ELEVENLABS_WEBSOCKET_ENABLED === 'true';
    return preferWebSocket && webSocketEnabled;
} 