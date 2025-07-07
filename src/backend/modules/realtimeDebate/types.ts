/**
 * Defines the core data structures for the real-time debate module.
 */

export interface AIPersonality {
  id: string;
  name: string;
  age: number;
  description: string;
  voicePrompt: string;
  voiceId: string;
  settings: {
    stability: number;
    similarity_boost: number;
    style?: number;
    use_speaker_boost?: boolean;
  };
}

export type DebatePhase = 'constructive' | 'rebuttal' | 'summary' | 'crossfire' | 'analysis';

export type DebateStance = 'Affirmative' | 'Negative';

export type DifficultyLevel = 'novice' | 'intermediate' | 'expert';

export interface DifficultyConfig {
  name: string;
  description: string;
  maxTokens: number;
  temperature: number;
  speakingSpeed: number;
  complexityLevel: string;
}

// Add other types as the module grows 