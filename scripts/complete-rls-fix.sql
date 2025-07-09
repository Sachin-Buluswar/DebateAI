-- COMPLETE RLS FIX - Comprehensive Security Setup
-- Run this entire script in Supabase SQL Editor

-- Step 1: Revoke all default permissions
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM authenticated;

-- Step 2: Grant specific permissions to anon and authenticated roles
-- These grants work WITH RLS policies, not instead of them

-- Health check - read only for everyone
GRANT SELECT ON public.health_check TO anon, authenticated;

-- For authenticated users - grant operations but RLS will filter
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.debate_sessions TO authenticated;
GRANT SELECT, INSERT ON public.debate_speeches TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.speech_feedback TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.saved_searches TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.user_preferences TO authenticated;
GRANT SELECT, INSERT ON public.audio_recordings TO authenticated;

-- Step 3: Drop ALL existing policies
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

-- Step 4: Enable RLS on all tables
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.debate_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.debate_speeches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.speech_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_searches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audio_recordings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.health_check ENABLE ROW LEVEL SECURITY;

-- Step 5: Create strict RLS policies

-- User profiles
CREATE POLICY "auth_users_own_profile" ON public.user_profiles
    FOR ALL USING (auth.uid() = id);

-- Debate sessions  
CREATE POLICY "auth_users_own_sessions" ON public.debate_sessions
    FOR ALL USING (auth.uid() = user_id);

-- Debate speeches
CREATE POLICY "auth_users_speeches_select" ON public.debate_speeches
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.debate_sessions ds
            WHERE ds.id = debate_speeches.session_id
            AND ds.user_id = auth.uid()
        )
    );

CREATE POLICY "auth_users_speeches_insert" ON public.debate_speeches
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.debate_sessions ds
            WHERE ds.id = debate_speeches.session_id
            AND ds.user_id = auth.uid()
        )
    );

-- Speech feedback
CREATE POLICY "auth_users_own_feedback" ON public.speech_feedback
    FOR ALL USING (auth.uid() = user_id);

-- Saved searches
CREATE POLICY "auth_users_own_searches" ON public.saved_searches
    FOR ALL USING (auth.uid() = user_id);

-- User preferences
CREATE POLICY "auth_users_own_preferences" ON public.user_preferences
    FOR ALL USING (auth.uid() = user_id);

-- Audio recordings
CREATE POLICY "auth_users_recordings_select" ON public.audio_recordings
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.debate_sessions ds
            WHERE ds.id = audio_recordings.session_id
            AND ds.user_id = auth.uid()
        )
    );

CREATE POLICY "auth_users_recordings_insert" ON public.audio_recordings
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.debate_sessions ds
            WHERE ds.id = audio_recordings.session_id
            AND ds.user_id = auth.uid()
        )
    );

-- Health check - anyone can read
CREATE POLICY "public_read_health" ON public.health_check
    FOR SELECT USING (true);

-- Step 6: Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_profiles_id ON public.user_profiles(id);
CREATE INDEX IF NOT EXISTS idx_debate_sessions_user_id ON public.debate_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_debate_speeches_session_id ON public.debate_speeches(session_id);
CREATE INDEX IF NOT EXISTS idx_speech_feedback_user_id ON public.speech_feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_searches_user_id ON public.saved_searches(user_id);
CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id ON public.user_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_audio_recordings_session_id ON public.audio_recordings(session_id);

-- Step 7: Verify the fix
SELECT 
    'Checking RLS Status:' as check_type,
    tablename,
    rowsecurity::text as detail,
    CASE 
        WHEN rowsecurity THEN '✅ RLS Enabled'
        ELSE '❌ RLS DISABLED!'
    END as status
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN (
    'user_profiles', 'debate_sessions', 'debate_speeches',
    'speech_feedback', 'saved_searches', 'user_preferences',
    'audio_recordings', 'health_check'
)

UNION ALL

SELECT 
    'Checking Permissions:' as check_type,
    table_name as tablename,
    grantee::text as detail,
    string_agg(privilege_type, ', ') as status
FROM information_schema.table_privileges
WHERE table_schema = 'public'
AND grantee IN ('anon', 'authenticated')
AND table_name IN (
    'user_profiles', 'debate_sessions', 'debate_speeches',
    'speech_feedback', 'saved_searches', 'user_preferences',
    'audio_recordings', 'health_check'
)
GROUP BY table_name, grantee

UNION ALL

SELECT 
    'Policy Count:' as check_type,
    tablename,
    ''::text as detail,
    count(*)::text || ' policies' as status
FROM pg_policies
WHERE schemaname = 'public'
GROUP BY tablename

ORDER BY check_type, tablename;