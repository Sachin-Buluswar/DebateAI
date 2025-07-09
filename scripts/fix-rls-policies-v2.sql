-- FIX RLS POLICIES - Version 2
-- This script properly restricts SELECT access

-- First, drop ALL existing policies to start clean
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT schemaname, tablename, policyname 
        FROM pg_policies 
        WHERE schemaname = 'public'
    ) LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', 
            r.policyname, r.schemaname, r.tablename);
    END LOOP;
END $$;

-- Ensure RLS is enabled
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.debate_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.debate_speeches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.speech_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_searches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audio_recordings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.health_check ENABLE ROW LEVEL SECURITY;

-- Create RESTRICTIVE policies for each table

-- 1. User profiles - only own profile
CREATE POLICY "Users can view own profile" ON public.user_profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.user_profiles
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON public.user_profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

-- 2. Debate sessions - only own sessions
CREATE POLICY "Users can view own debate sessions" ON public.debate_sessions
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create debate sessions" ON public.debate_sessions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own debate sessions" ON public.debate_sessions
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own debate sessions" ON public.debate_sessions
    FOR DELETE USING (auth.uid() = user_id);

-- 3. Debate speeches - only from own sessions
CREATE POLICY "Users can view speeches from own sessions" ON public.debate_speeches
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.debate_sessions
            WHERE debate_sessions.id = debate_speeches.session_id
            AND debate_sessions.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert speeches to own sessions" ON public.debate_speeches
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.debate_sessions
            WHERE debate_sessions.id = debate_speeches.session_id
            AND debate_sessions.user_id = auth.uid()
        )
    );

-- 4. Speech feedback - only own feedback
CREATE POLICY "Users can view own speech feedback" ON public.speech_feedback
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create speech feedback" ON public.speech_feedback
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own speech feedback" ON public.speech_feedback
    FOR UPDATE USING (auth.uid() = user_id);

-- 5. Saved searches - only own searches
CREATE POLICY "Users can view own saved searches" ON public.saved_searches
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create saved searches" ON public.saved_searches
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own saved searches" ON public.saved_searches
    FOR DELETE USING (auth.uid() = user_id);

-- 6. User preferences - only own preferences
CREATE POLICY "Users can view own preferences" ON public.user_preferences
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create preferences" ON public.user_preferences
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own preferences" ON public.user_preferences
    FOR UPDATE USING (auth.uid() = user_id);

-- 7. Audio recordings - only from own sessions
CREATE POLICY "Users can view audio from own sessions" ON public.audio_recordings
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.debate_sessions
            WHERE debate_sessions.id = audio_recordings.session_id
            AND debate_sessions.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert audio to own sessions" ON public.audio_recordings
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.debate_sessions
            WHERE debate_sessions.id = audio_recordings.session_id
            AND debate_sessions.user_id = auth.uid()
        )
    );

-- 8. Health check - public read only
CREATE POLICY "Anyone can read health check" ON public.health_check
    FOR SELECT USING (true);

-- NO OTHER OPERATIONS ALLOWED ON HEALTH CHECK

-- Verify the policies are created
SELECT 
    tablename,
    policyname,
    cmd,
    permissive,
    qual
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;