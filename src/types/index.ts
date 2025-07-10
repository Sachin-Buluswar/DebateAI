export interface User {
  id: string;
  email: string;
  created_at: string;
}

export interface Debate {
  id: string;
  user_id: string;
  title: string;
  type: string;
  description?: string;
  transcript?: string;
  created_at: string;
  updated_at: string;
  audio_url?: string;
  
  // UI compatibility properties (not in the database)
  topic?: string;
  status?: 'active' | 'completed' | 'paused';
  format?: 'parliamentary' | 'policy' | 'lincoln_douglas';
  position?: 'affirmative' | 'negative';
}

export interface DebateMessage {
  role: 'user' | 'ai' | 'system';
  content: string;
  timestamp: string;
}

export interface SpeechFeedback {
  id: string;
  user_id: string;
  topic: string;
  speech_type?: string;
  speech_types?: string;
  user_side?: string;
  custom_instructions?: string;
  audio_url?: string;
  file_path?: string;
  transcription?: string;
  file_size_bytes?: number;
  duration_seconds?: number;
  feedback: {
    // Old format fields
    overall?: string;
    delivery?: {
      pronunciation: string[];
      pacing: string[];
      vocalVariety: string[];
      volume: string[];
    };
    arguments?: {
      claims: string[];
      evidence: string[];
      organization: string[];
      counterarguments: string[];
    };
    persuasiveness?: {
      ethos: string[];
      pathos: string[];
      logos: string[];
    };
    recommendations?: string[];
    scores?: {
      delivery: number;
      arguments: number;
      persuasiveness: number;
      overall: number;
    };
    // Legacy fields for backward compatibility
    content?: string[];
    improvements?: string[];
    pronunciation?: string[];
    pacing?: string[];
    intonation?: string[];
    clarity?: string[];
    score?: number;
    
    // New structured format fields
    speakerScore?: number;
    scoreJustification?: string;
    overallSummary?: string;
    structureOrganization?: {
      analysis: string;
      examples: string[];
      suggestions: string[];
    };
    argumentationEvidence?: {
      analysis: string;
      examples: string[];
      suggestions: string[];
    };
    clarityConciseness?: {
      analysis: string;
      examples: string[];
      suggestions: string[];
    };
    persuasivenessImpact?: {
      analysis: string;
      examples: string[];
      suggestions: string[];
    };
    deliveryStyle?: {
      analysis: string;
      examples: string[];
      suggestions: string[];
    };
    relevanceToSpeechType?: {
      analysis: string;
      examples: string[];
      suggestions: string[];
    };
    actionableSuggestions?: string[];
    strengths?: string[];
    areasForImprovement?: string[];
    
    // Additional fields for error states
    message?: string;
  } | null;
  created_at: string;
  updated_at?: string;
}

export interface SavedSearch {
  id: string;
  user_id: string;
  query: string;
  results_count: number;
  created_at: string;
}

export interface SearchResult {
  content: string;
  source: string;
  score: number;
}

export interface GeneratedAnswer {
  answer: string;
  sources: { source: string }[];
}

export interface SavedEvidence {
  id: string;
  user_id: string;
  content: string;
  source: string;
  relevance_score: number;
  created_at: string;
}

export interface ApiError {
  message: string;
  code: string;
  status: number;
} 