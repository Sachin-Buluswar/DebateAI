import fetch from 'node-fetch';
import { env } from '@/shared/env';
import type { Response } from 'node-fetch';
import { debateConfig } from '@/backend/modules/realtimeDebate/debate.config';
import { servicesConfig } from '@/backend/config/services.config';
import { DifficultyLevel } from '@/backend/modules/realtimeDebate/types';

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

        const response = await fetch(
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

        if (!response.ok) {
            const errorData = await response.json();
            console.error('ElevenLabs API Error:', errorData);
            throw new Error('Failed to generate audio from ElevenLabs.');
        }

        return response;
    } catch (error) {
        console.error('Error generating audio stream:', error);
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