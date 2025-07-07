// Centralised runtime/shareable constants (importable from both client and server)
// -------------------------------------------------------------
// PLEASE keep this file free of Node-specific APIs; only literal
// values so that it can be tree-shaken in the browser bundle.

export const STORAGE_BUCKET_SPEECH_AUDIO = 'speech_audio' as const;
export const STORAGE_BUCKET_DEBATE_AUDIO  = 'debate_audio'  as const;

// Upload limits – keep in sync with Supabase bucket settings & OpenAI
export const MAX_UPLOAD_SIZE_BYTES   = 25 * 1024 * 1024;  // 25 MB (OpenAI Whisper limit)
export const MAX_USER_STORAGE_BYTES  = 600 * 1024 * 1024; // 600 MB per user
export const MAX_RECORDING_MINUTES   = 65;                // Client recording limit

// Client-side chunk size (balances latency vs. memory) – 5 MB
export const UPLOAD_CHUNK_SIZE_BYTES = 5 * 1024 * 1024;

export const AUDIO_MIME_WHITELIST: ReadonlyArray<string> = [
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/ogg',
  'audio/webm',
  'audio/aac',
  'audio/flac',
  'audio/m4a',
  'audio/x-m4a'
] as const; 