-- Add columns for saving debate state
ALTER TABLE public.debate_sessions 
ADD COLUMN IF NOT EXISTS saved_state JSONB,
ADD COLUMN IF NOT EXISTS last_saved_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

-- Add audio recording storage
CREATE TABLE IF NOT EXISTS public.audio_recordings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    session_id UUID REFERENCES public.debate_sessions(id) ON DELETE CASCADE,
    speaker_id TEXT NOT NULL,
    speaker_name TEXT NOT NULL,
    phase TEXT NOT NULL,
    audio_url TEXT,
    duration_seconds INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on audio_recordings
ALTER TABLE public.audio_recordings ENABLE ROW LEVEL SECURITY;

-- Create policy for audio_recordings
CREATE POLICY "audio_recordings_user_access" ON public.audio_recordings
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.debate_sessions
            WHERE debate_sessions.id = audio_recordings.session_id
            AND (debate_sessions.user_id = auth.uid() OR debate_sessions.user_id IS NULL)
        )
    );

-- Add index
CREATE INDEX IF NOT EXISTS idx_audio_recordings_session_id ON public.audio_recordings(session_id); 