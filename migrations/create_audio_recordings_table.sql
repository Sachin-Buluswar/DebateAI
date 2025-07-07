-- Create audio_recordings table for storing debate audio files
CREATE TABLE IF NOT EXISTS audio_recordings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES debate_sessions(id) ON DELETE CASCADE,
  speaker_id TEXT NOT NULL,
  speaker_name TEXT NOT NULL,
  phase TEXT NOT NULL,
  audio_url TEXT, -- URL to the audio file in Supabase storage
  audio_data TEXT, -- Base64 encoded audio for smaller files
  duration_seconds INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_audio_recordings_session_id ON audio_recordings(session_id);
CREATE INDEX IF NOT EXISTS idx_audio_recordings_speaker_id ON audio_recordings(speaker_id);
CREATE INDEX IF NOT EXISTS idx_audio_recordings_phase ON audio_recordings(phase);

-- Enable RLS
ALTER TABLE audio_recordings ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view audio from their sessions"
  ON audio_recordings
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM debate_sessions
      WHERE debate_sessions.id = audio_recordings.session_id
      AND debate_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Service role can insert audio"
  ON audio_recordings
  FOR INSERT
  WITH CHECK (true); -- Only backend with service role can insert

CREATE POLICY "Service role can update audio"
  ON audio_recordings
  FOR UPDATE
  USING (true); -- Only backend with service role can update 