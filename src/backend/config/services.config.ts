/**
 * Configuration for third-party services used in the application.
 * This file centralizes API endpoints, model IDs, and other settings
 * for services like ElevenLabs.
 */

export const servicesConfig = {
  elevenLabs: {
    /**
     * The model ID for Text-to-Speech (TTS) generation.
     */
    ttsModelId: 'eleven_turbo_v2',

    /**
     * The model ID for Speech-to-Text (STT) transcription.
     */
    sttModelId: 'eleven_multilingual_v2',

    /**
     * The voice ID for the narrator/system voice.
     */
    narratorVoiceId: '21m00Tcm4TlvDq8ikWAM', // Example: "Rachel" from ElevenLabs

    /**
     * The latency optimization level for TTS streaming.
     * 0: Default
     * 1: Good latency
     * 2: Great latency
     * 3: Excellent latency
     * 4: Best latency (may affect quality)
     */
    latencyOptimization: 2,

    /**
     * The API endpoint for generating speech.
     */
    apiBaseUrl: 'https://api.elevenlabs.io/v1',
  },

  // Future services can be added here.
}; 