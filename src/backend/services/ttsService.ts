/**
 * TTS Service - Text-to-Speech integration for the debate system
 * 
 * This service provides multiple methods for converting text to speech,
 * optimized for different use cases in the debate application.
 * 
 * Role in the System:
 * - Primary voice synthesis for AI debate agents
 * - Supports both HTTP streaming and WebSocket for flexibility
 * - Handles voice personalization and difficulty adjustments
 * - Provides fallback mechanisms for reliability
 * 
 * Integration Methods:
 * 1. HTTP Streaming (generateAudioStreamResponse)
 *    - Higher latency (~500ms) but more reliable
 *    - Better for pre-generated content
 *    - Supports full response caching
 * 
 * 2. WebSocket Streaming (generateAudioStreamWebSocket)
 *    - Lower latency (~100ms) for real-time interaction
 *    - Ideal for live debate responses
 *    - Requires persistent connection management
 * 
 * Authentication:
 * - Uses ELEVENLABS_API_KEY from environment
 * - Supports multiple voice IDs for different speakers
 */

import { env } from '@/shared/env';
import { debateConfig } from '@/backend/modules/realtimeDebate/debate.config';
import { servicesConfig } from '@/backend/config/services.config';
import { DifficultyLevel } from '@/backend/modules/realtimeDebate/types';
import { globalErrorRecovery } from '@/lib/errorRecovery';
import { ElevenLabsWebSocketService, createElevenLabsWebSocketForSpeaker } from './elevenLabsWebSocket';

/**
 * Generates a readable audio stream from text using the ElevenLabs HTTP API.
 * 
 * This is the primary method for TTS when reliability is more important than latency.
 * Uses HTTP streaming to receive audio data progressively.
 * 
 * Voice Selection Logic:
 * 1. If speakerName provided, uses personality-specific voice
 * 2. Falls back to narrator voice if speaker not found
 * 3. Each voice has customized settings for distinctiveness
 * 
 * Difficulty Adjustments:
 * - Style parameter modifies speaking pace
 * - Beginner: 80% speed for clarity
 * - Intermediate: 100% normal speed
 * - Expert: 120% speed for experienced users
 * 
 * Error Handling:
 * - Automatic retry with exponential backoff
 * - Fallback to narrator voice on speaker voice failure
 * - Returns null on complete failure for graceful degradation
 * 
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
            // Voice Settings Explanation:
            // - stability: Controls voice consistency (0=variable, 1=monotone)
            // - similarity_boost: How closely to match the original voice
            // - style: Affects expressiveness AND speaking pace
            // 
            // We use style to control speed since ElevenLabs lacks a direct speed parameter
            // Higher style values tend to produce more animated, faster speech
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
                            model_id: servicesConfig.elevenLabs.ttsModelId, // eleven_turbo_v2 for low latency
                            voice_settings: voiceSettings,
                        }),
                    }
                );

                if (!res.ok) {
                    const errorData = await res.json();
                    
                    // Create error with status for retry logic
                    const ttsError = new Error(`ElevenLabs TTS failed: ${errorData.detail?.message || 'Unknown error'}`);
                    (ttsError as unknown as Record<string, unknown>).status = res.status;
                    throw ttsError;
                }

                return res;
            },
            {
                retryOptions: {
                    maxRetries: 3,
                    onRetry: (_error, _attempt) => {
                    },
                    shouldRetry: (error) => {
                        // Retry Strategy:
                        // - 401: Authentication failure - configuration issue, don't retry
                        // - 400: Bad request - likely invalid text or settings, don't retry
                        // - 429: Rate limit - retry with backoff
                        // - 5xx: Server errors - transient, retry
                        // - Network errors - retry
                        if ((error as unknown as Record<string, unknown>).status === 401) return false;
                        if ((error as unknown as Record<string, unknown>).status === 400) return false;
                        return true;
                    }
                },
                fallbacks: [
                    // Fallback Strategy:
                    // If the requested voice fails (e.g., quota exceeded, voice deleted),
                    // we fall back to the narrator voice which should always be available.
                    // This ensures the debate can continue even if specific voices fail.
                    async () => {
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
                                    voice_settings: { stability: 0.5, similarity_boost: 0.75 }, // Neutral settings
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
    } catch (_error) {
        return null;
    }
}

/**
 * Helper that wraps generateAudioStreamResponse and returns a single ArrayBuffer
 * containing the entire MP3 audio for easier transport to the client.
 * 
 * This method is useful when:
 * - The complete audio needs to be buffered before playback
 * - Sending audio data through channels that don't support streaming
 * - Caching complete audio responses
 * 
 * Trade-offs:
 * - Higher memory usage (entire audio in memory)
 * - Longer initial delay (must receive all data)
 * - Simpler client-side handling
 * 
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
 * 
 * This is the preferred method for real-time debate interactions where
 * low latency is critical for natural conversation flow.
 * 
 * Advantages over HTTP streaming:
 * - First audio chunk arrives in ~100ms vs ~500ms
 * - Supports progressive text input (send as you generate)
 * - Better for interactive applications
 * 
 * Implementation details:
 * - Creates a dedicated WebSocket connection per request
 * - Automatically handles connection lifecycle
 * - Collects audio chunks for processing
 * - Implements timeout protection (30 seconds)
 * 
 * Chunk handling:
 * - Audio arrives in small MP3 chunks (~1-5KB each)
 * - Can be played progressively or buffered
 * - Callback allows real-time processing
 * 
 * Error scenarios:
 * - Connection failures trigger automatic cleanup
 * - Timeouts prevent hanging connections
 * - Stream errors are propagated to caller
 * 
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
                
                // Completion Detection:
                // ElevenLabs doesn't send an explicit end-of-stream signal,
                // so we use a heuristic: if no new chunks arrive for 2 seconds,
                // we assume the stream is complete.
                // 
                // This works because:
                // - Audio generation is typically continuous
                // - Network delays rarely exceed 2 seconds
                // - False positives just end streaming slightly early
                // 
                // In production, consider:
                // - Implementing a proper end-of-stream protocol
                // - Using flush messages to signal completion
                // - Tracking expected audio duration
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
 * 
 * This function implements a feature flag pattern for gradual rollout:
 * 1. Development: HTTP by default for stability
 * 2. Testing: Enable WebSocket via environment variable
 * 3. Production: Gradually increase WebSocket usage
 * 
 * Decision factors:
 * - WebSocket: Better for real-time, interactive use
 * - HTTP: Better for reliability, simpler infrastructure
 * 
 * Future enhancements:
 * - A/B testing between protocols
 * - Dynamic switching based on network conditions
 * - Per-user protocol preferences
 * - Automatic fallback on WebSocket failures
 * 
 * @param preferWebSocket Whether to prefer WebSocket streaming when available
 * @returns Boolean indicating if WebSocket should be used
 */
export function shouldUseWebSocket(preferWebSocket = true): boolean {
    // For now, default to HTTP until WebSocket is fully tested
    // In production, this can be controlled by environment variable
    const webSocketEnabled = process.env.ELEVENLABS_WEBSOCKET_ENABLED === 'true';
    return preferWebSocket && webSocketEnabled;
} 