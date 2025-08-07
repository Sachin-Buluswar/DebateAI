/**
 * Shared Debate Configuration
 * This file contains shared configuration used by both modules and services
 * to avoid circular dependencies between them.
 */

export const DEBATE_PHASES = {
  CONSTRUCTIVE_1: 'CONSTRUCTIVE_1',
  CROSSFIRE_1: 'CROSSFIRE_1',
  REBUTTAL_1: 'REBUTTAL_1',
  CROSSFIRE_2: 'CROSSFIRE_2',
  REBUTTAL_2: 'REBUTTAL_2',
  GRAND_CROSSFIRE: 'GRAND_CROSSFIRE',
  FINAL_FOCUS_1: 'FINAL_FOCUS_1',
  FINAL_FOCUS_2: 'FINAL_FOCUS_2',
  DEBATE_ENDED: 'DEBATE_ENDED'
} as const;

export type DebatePhase = keyof typeof DEBATE_PHASES;

export const DEBATE_TIMINGS = {
  CONSTRUCTIVE_1: 240000, // 4 minutes
  CROSSFIRE_1: 180000, // 3 minutes
  REBUTTAL_1: 240000, // 4 minutes
  CROSSFIRE_2: 180000, // 3 minutes
  REBUTTAL_2: 240000, // 4 minutes
  GRAND_CROSSFIRE: 180000, // 3 minutes
  FINAL_FOCUS_1: 120000, // 2 minutes
  FINAL_FOCUS_2: 120000, // 2 minutes
} as const;

export const DEFAULT_VOICE_CONFIG = {
  DEFAULT_VOICE_ID: 'EXAVITQu4vr4xnSDxMaL',
  DEFAULT_MODEL_ID: 'eleven_turbo_v2',
  STABILITY: 0.5,
  SIMILARITY_BOOST: 0.8,
  STYLE: 0,
  USE_SPEAKER_BOOST: true
} as const;

export const AI_CONFIG = {
  DEFAULT_MODEL: 'gpt-4o-mini',
  TEMPERATURE: 0.7,
  MAX_TOKENS: 500,
  PERSONALITIES: {
    'confident-debater': {
      name: 'Confident Debater',
      systemPrompt: 'You are a confident and articulate debater. Present your arguments clearly and persuasively.',
      voiceId: 'EXAVITQu4vr4xnSDxMaL'
    },
    'analytical-thinker': {
      name: 'Analytical Thinker',
      systemPrompt: 'You are an analytical thinker who focuses on logic and evidence. Break down arguments systematically.',
      voiceId: 'pNInz6obpgDQGcFmaJgB'
    },
    'passionate-advocate': {
      name: 'Passionate Advocate',
      systemPrompt: 'You are a passionate advocate who speaks with conviction and emotion. Use pathos effectively.',
      voiceId: 'ThT5KcBeYPX3keUQqHPh'
    }
  }
} as const;

export interface DebateConfig {
  topic: string;
  format: string;
  timePerSpeech: number;
  preparationTime: number;
  maxParticipants: number;
}

export const DEFAULT_DEBATE_CONFIG: DebateConfig = {
  topic: '',
  format: 'public-forum',
  timePerSpeech: 240, // 4 minutes in seconds
  preparationTime: 120, // 2 minutes in seconds
  maxParticipants: 4
};