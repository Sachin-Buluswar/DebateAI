-- CRITICAL SECURITY FIX: Apply Row Level Security to all tables

-- 1. Enable RLS on all user data tables
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.debate_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.debate_speeches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.speech_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_searches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audio_recordings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.health_check ENABLE ROW LEVEL SECURITY;

-- 2. Drop any existing policies to start fresh
DROP POLICY IF EXISTS "user_profiles_user_access" ON public.user_profiles;
DROP POLICY IF EXISTS "debate_sessions_user_access" ON public.debate_sessions;
DROP POLICY IF EXISTS "debate_speeches_user_access" ON public.debate_speeches;
DROP POLICY IF EXISTS "speech_feedback_user_access" ON public.speech_feedback;
DROP POLICY IF EXISTS "saved_searches_user_access" ON public.saved_searches;
DROP POLICY IF EXISTS "user_preferences_user_access" ON public.user_preferences;
DROP POLICY IF EXISTS "audio_recordings_user_access" ON public.audio_recordings;
DROP POLICY IF EXISTS "health_check_public_read" ON public.health_check;

-- 3. User profiles - users can only access their own profile
CREATE POLICY "user_profiles_user_access" ON public.user_profiles
    FOR ALL
    USING (auth.uid() = id);

-- 4. Debate sessions - users can only access their own sessions
CREATE POLICY "debate_sessions_user_access" ON public.debate_sessions
    FOR ALL
    USING (auth.uid() = user_id OR user_id IS NULL);

-- 5. Debate speeches - users can access speeches from their sessions
CREATE POLICY "debate_speeches_user_access" ON public.debate_speeches
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.debate_sessions
            WHERE debate_sessions.id = debate_speeches.session_id
            AND (debate_sessions.user_id = auth.uid() OR debate_sessions.user_id IS NULL)
        )
    );

-- 6. Speech feedback - users can only access their own feedback
CREATE POLICY "speech_feedback_user_access" ON public.speech_feedback
    FOR ALL
    USING (auth.uid() = user_id);

-- 7. Saved searches - users can only access their own searches
CREATE POLICY "saved_searches_user_access" ON public.saved_searches
    FOR ALL
    USING (auth.uid() = user_id);

-- 8. User preferences - users can only access their own preferences
CREATE POLICY "user_preferences_user_access" ON public.user_preferences
    FOR ALL
    USING (auth.uid() = user_id);

-- 9. Audio recordings - users can access recordings from their sessions
CREATE POLICY "audio_recordings_user_access" ON public.audio_recordings
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.debate_sessions
            WHERE debate_sessions.id = audio_recordings.session_id
            AND (debate_sessions.user_id = auth.uid() OR debate_sessions.user_id IS NULL)
        )
    );

-- 10. Health check - allow public read access only
CREATE POLICY "health_check_public_read" ON public.health_check
    FOR SELECT
    USING (true);

-- 11. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_user_profiles_id ON public.user_profiles(id);
CREATE INDEX IF NOT EXISTS idx_debate_sessions_user_id ON public.debate_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_debate_speeches_session_id ON public.debate_speeches(session_id);
CREATE INDEX IF NOT EXISTS idx_speech_feedback_user_id ON public.speech_feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_searches_user_id ON public.saved_searches(user_id);
CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id ON public.user_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_audio_recordings_session_id ON public.audio_recordings(session_id);

-- Verify RLS is enabled
SELECT 
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN (
    'user_profiles',
    'debate_sessions',
    'debate_speeches',
    'speech_feedback',
    'saved_searches',
    'user_preferences',
    'audio_recordings',
    'health_check'
)
ORDER BY tablename;