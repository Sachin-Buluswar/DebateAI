-- CRITICAL FIX: Add missing RLS policies for unprotected tables
-- This migration fixes the blocking issue preventing debates from working

-- ============================================
-- 1. DEBATES TABLE POLICIES
-- ============================================

-- Enable RLS if not already enabled
ALTER TABLE debates ENABLE ROW LEVEL SECURITY;

-- Drop any existing policies to start fresh
DROP POLICY IF EXISTS "Users can view all debates" ON debates;
DROP POLICY IF EXISTS "Users can create debates" ON debates;
DROP POLICY IF EXISTS "Users can update own debates" ON debates;
DROP POLICY IF EXISTS "Users can delete own debates" ON debates;

-- Allow authenticated users to view all debates
CREATE POLICY "Users can view all debates" ON debates
    FOR SELECT
    TO authenticated
    USING (true);

-- Allow authenticated users to create debates
CREATE POLICY "Users can create debates" ON debates
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = created_by);

-- Allow users to update their own debates
CREATE POLICY "Users can update own debates" ON debates
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = created_by)
    WITH CHECK (auth.uid() = created_by);

-- Allow users to delete their own debates
CREATE POLICY "Users can delete own debates" ON debates
    FOR DELETE
    TO authenticated
    USING (auth.uid() = created_by);

-- ============================================
-- 2. DEBATE_HISTORY TABLE POLICIES
-- ============================================

ALTER TABLE debate_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view debate history" ON debate_history;
DROP POLICY IF EXISTS "Users can insert debate history" ON debate_history;

-- Allow users to view all debate history
CREATE POLICY "Users can view debate history" ON debate_history
    FOR SELECT
    TO authenticated
    USING (true);

-- Allow system to insert debate history (usually done via triggers or service role)
CREATE POLICY "Users can insert debate history" ON debate_history
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- ============================================
-- 3. DEBATE_FEEDBACK TABLE POLICIES
-- ============================================

ALTER TABLE debate_feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view all feedback" ON debate_feedback;
DROP POLICY IF EXISTS "Users can create feedback" ON debate_feedback;
DROP POLICY IF EXISTS "Users can update own feedback" ON debate_feedback;
DROP POLICY IF EXISTS "Users can delete own feedback" ON debate_feedback;

-- Allow users to view all feedback
CREATE POLICY "Users can view all feedback" ON debate_feedback
    FOR SELECT
    TO authenticated
    USING (true);

-- Allow users to create feedback
CREATE POLICY "Users can create feedback" ON debate_feedback
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

-- Allow users to update their own feedback
CREATE POLICY "Users can update own feedback" ON debate_feedback
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Allow users to delete their own feedback
CREATE POLICY "Users can delete own feedback" ON debate_feedback
    FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id);

-- ============================================
-- 4. SPEECH_RECORDINGS TABLE POLICIES
-- ============================================

ALTER TABLE speech_recordings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own recordings" ON speech_recordings;
DROP POLICY IF EXISTS "Users can create recordings" ON speech_recordings;
DROP POLICY IF EXISTS "Users can update own recordings" ON speech_recordings;
DROP POLICY IF EXISTS "Users can delete own recordings" ON speech_recordings;
DROP POLICY IF EXISTS "Public can view shared recordings" ON speech_recordings;

-- Users can view their own recordings
CREATE POLICY "Users can view own recordings" ON speech_recordings
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

-- Users can create recordings
CREATE POLICY "Users can create recordings" ON speech_recordings
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

-- Users can update their own recordings
CREATE POLICY "Users can update own recordings" ON speech_recordings
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Users can delete their own recordings
CREATE POLICY "Users can delete own recordings" ON speech_recordings
    FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id);

-- Optional: Allow viewing of shared recordings (if there's a is_public column)
-- Uncomment if you have a is_public or shared column
-- CREATE POLICY "Public can view shared recordings" ON speech_recordings
--     FOR SELECT
--     TO authenticated
--     USING (is_public = true OR auth.uid() = user_id);

-- ============================================
-- 5. VERIFY POLICIES ARE ACTIVE
-- ============================================

-- This query will show all tables and their policy counts
-- Run this after applying the migration to verify
/*
SELECT 
    schemaname,
    tablename,
    COUNT(*) as policy_count
FROM pg_policies 
WHERE schemaname = 'public' 
    AND tablename IN ('debates', 'debate_history', 'debate_feedback', 'speech_recordings')
GROUP BY schemaname, tablename
ORDER BY tablename;
*/

-- Expected result: Each table should have at least 2-4 policies