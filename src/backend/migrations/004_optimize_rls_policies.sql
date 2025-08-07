-- Optimize RLS policies for better performance
-- Replace auth.uid() with (SELECT auth.uid()) to prevent re-evaluation per row

-- ============================================
-- OPTIMIZE USER_PROFILES POLICIES
-- ============================================

DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;
CREATE POLICY "Users can view own profile" ON user_profiles
    FOR SELECT
    TO authenticated
    USING (id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
CREATE POLICY "Users can update own profile" ON user_profiles
    FOR UPDATE
    TO authenticated
    USING (id = (SELECT auth.uid()))
    WITH CHECK (id = (SELECT auth.uid()));

-- ============================================
-- OPTIMIZE SAVED_SEARCHES POLICIES
-- ============================================

DROP POLICY IF EXISTS "Users can view own searches" ON saved_searches;
CREATE POLICY "Users can view own searches" ON saved_searches
    FOR SELECT
    TO authenticated
    USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can create searches" ON saved_searches;
CREATE POLICY "Users can create searches" ON saved_searches
    FOR INSERT
    TO authenticated
    WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can delete own searches" ON saved_searches;
CREATE POLICY "Users can delete own searches" ON saved_searches
    FOR DELETE
    TO authenticated
    USING (user_id = (SELECT auth.uid()));

-- ============================================
-- OPTIMIZE SPEECH_FEEDBACK POLICIES
-- ============================================

DROP POLICY IF EXISTS "Users can view own feedback" ON speech_feedback;
CREATE POLICY "Users can view own feedback" ON speech_feedback
    FOR SELECT
    TO authenticated
    USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can create feedback" ON speech_feedback;
CREATE POLICY "Users can create feedback" ON speech_feedback
    FOR INSERT
    TO authenticated
    WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can update own feedback" ON speech_feedback;
CREATE POLICY "Users can update own feedback" ON speech_feedback
    FOR UPDATE
    TO authenticated
    USING (user_id = (SELECT auth.uid()))
    WITH CHECK (user_id = (SELECT auth.uid()));

-- ============================================
-- OPTIMIZE AUDIO_RECORDINGS POLICIES
-- ============================================

DROP POLICY IF EXISTS "Users can view own recordings" ON audio_recordings;
CREATE POLICY "Users can view own recordings" ON audio_recordings
    FOR SELECT
    TO authenticated
    USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can create recordings" ON audio_recordings;
CREATE POLICY "Users can create recordings" ON audio_recordings
    FOR INSERT
    TO authenticated
    WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can update own recordings" ON audio_recordings;
CREATE POLICY "Users can update own recordings" ON audio_recordings
    FOR UPDATE
    TO authenticated
    USING (user_id = (SELECT auth.uid()))
    WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can delete own recordings" ON audio_recordings;
CREATE POLICY "Users can delete own recordings" ON audio_recordings
    FOR DELETE
    TO authenticated
    USING (user_id = (SELECT auth.uid()));

-- ============================================
-- OPTIMIZE DEBATE_SPEECHES POLICIES
-- ============================================

DROP POLICY IF EXISTS "Users can view speeches from their sessions" ON debate_speeches;
CREATE POLICY "Users can view speeches from their sessions" ON debate_speeches
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM debate_sessions 
            WHERE debate_sessions.id = debate_speeches.session_id 
            AND debate_sessions.user_id = (SELECT auth.uid())
        )
    );

DROP POLICY IF EXISTS "Users can create speeches in their sessions" ON debate_speeches;
CREATE POLICY "Users can create speeches in their sessions" ON debate_speeches
    FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM debate_sessions 
            WHERE debate_sessions.id = debate_speeches.session_id 
            AND debate_sessions.user_id = (SELECT auth.uid())
        )
    );

-- ============================================
-- RE-OPTIMIZE THE NEWLY ADDED POLICIES
-- ============================================

-- Optimize debates table policies
DROP POLICY IF EXISTS "Users can create debates" ON debates;
CREATE POLICY "Users can create debates" ON debates
    FOR INSERT
    TO authenticated
    WITH CHECK (created_by = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can update own debates" ON debates;
CREATE POLICY "Users can update own debates" ON debates
    FOR UPDATE
    TO authenticated
    USING (created_by = (SELECT auth.uid()))
    WITH CHECK (created_by = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can delete own debates" ON debates;
CREATE POLICY "Users can delete own debates" ON debates
    FOR DELETE
    TO authenticated
    USING (created_by = (SELECT auth.uid()));

-- Optimize debate_feedback policies
DROP POLICY IF EXISTS "Users can create feedback" ON debate_feedback;
CREATE POLICY "Users can create feedback" ON debate_feedback
    FOR INSERT
    TO authenticated
    WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can update own feedback" ON debate_feedback;
CREATE POLICY "Users can update own feedback" ON debate_feedback
    FOR UPDATE
    TO authenticated
    USING (user_id = (SELECT auth.uid()))
    WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can delete own feedback" ON debate_feedback;
CREATE POLICY "Users can delete own feedback" ON debate_feedback
    FOR DELETE
    TO authenticated
    USING (user_id = (SELECT auth.uid()));

-- Optimize speech_recordings policies
DROP POLICY IF EXISTS "Users can view own recordings" ON speech_recordings;
CREATE POLICY "Users can view own recordings" ON speech_recordings
    FOR SELECT
    TO authenticated
    USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can create recordings" ON speech_recordings;
CREATE POLICY "Users can create recordings" ON speech_recordings
    FOR INSERT
    TO authenticated
    WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can update own recordings" ON speech_recordings;
CREATE POLICY "Users can update own recordings" ON speech_recordings
    FOR UPDATE
    TO authenticated
    USING (user_id = (SELECT auth.uid()))
    WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can delete own recordings" ON speech_recordings;
CREATE POLICY "Users can delete own recordings" ON speech_recordings
    FOR DELETE
    TO authenticated
    USING (user_id = (SELECT auth.uid()));

-- Optimize debate_sessions policies
DROP POLICY IF EXISTS "Users can view own sessions" ON debate_sessions;
CREATE POLICY "Users can view own sessions" ON debate_sessions
    FOR SELECT
    TO authenticated
    USING (user_id = (SELECT auth.uid()) OR user_id IS NULL);

DROP POLICY IF EXISTS "Users can create sessions" ON debate_sessions;
CREATE POLICY "Users can create sessions" ON debate_sessions
    FOR INSERT
    TO authenticated
    WITH CHECK (user_id = (SELECT auth.uid()) OR user_id IS NULL);

DROP POLICY IF EXISTS "Users can update own sessions" ON debate_sessions;
CREATE POLICY "Users can update own sessions" ON debate_sessions
    FOR UPDATE
    TO authenticated
    USING (user_id = (SELECT auth.uid()) OR user_id IS NULL)
    WITH CHECK (user_id = (SELECT auth.uid()) OR user_id IS NULL);

DROP POLICY IF EXISTS "Users can delete own sessions" ON debate_sessions;
CREATE POLICY "Users can delete own sessions" ON debate_sessions
    FOR DELETE
    TO authenticated
    USING (user_id = (SELECT auth.uid()) OR user_id IS NULL);