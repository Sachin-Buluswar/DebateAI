-- Enable Row Level Security on all public tables
ALTER TABLE public.health_check ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.debate_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.debate_speeches ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "health_check_public_read" ON public.health_check;
DROP POLICY IF EXISTS "debate_sessions_user_access" ON public.debate_sessions;
DROP POLICY IF EXISTS "debate_speeches_user_access" ON public.debate_speeches;

-- Health check table - allow public read access
CREATE POLICY "health_check_public_read" ON public.health_check
    FOR SELECT
    USING (true);

-- Debate sessions - users can only access their own sessions
CREATE POLICY "debate_sessions_user_access" ON public.debate_sessions
    FOR ALL
    USING (
        auth.uid() IS NOT NULL AND (
            user_id = auth.uid() OR 
            user_id IS NULL -- Allow access to sessions created before auth was implemented
        )
    );

-- Debate speeches - users can access speeches from their sessions
CREATE POLICY "debate_speeches_user_access" ON public.debate_speeches
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.debate_sessions
            WHERE debate_sessions.id = debate_speeches.session_id
            AND (debate_sessions.user_id = auth.uid() OR debate_sessions.user_id IS NULL)
        )
    );

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_debate_sessions_user_id ON public.debate_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_debate_speeches_session_id ON public.debate_speeches(session_id); -- Add columns for saving debate state
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

-- Drop policy if it already exists to make migration idempotent
DROP POLICY IF EXISTS "audio_recordings_user_access" ON public.audio_recordings;

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
CREATE INDEX IF NOT EXISTS idx_audio_recordings_session_id ON public.audio_recordings(session_id); -- Create user preferences table
CREATE TABLE IF NOT EXISTS public.user_preferences (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    notification_settings JSONB DEFAULT '{"email": true, "push": false}'::jsonb,
    debate_settings JSONB DEFAULT '{"default_side": "PRO", "ai_partner": false, "difficulty": "medium"}'::jsonb,
    display_settings JSONB DEFAULT '{"theme": "system", "language": "en"}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view own preferences" ON public.user_preferences
    FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own preferences" ON public.user_preferences
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own preferences" ON public.user_preferences
    FOR UPDATE
    USING (auth.uid() = user_id);

-- Create trigger to update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_user_preferences_updated_at BEFORE UPDATE
    ON public.user_preferences FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create index
CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id ON public.user_preferences(user_id); 