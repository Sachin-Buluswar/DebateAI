-- Add missing indexes for foreign keys to improve performance
-- These were identified as missing by the Supabase security advisor

-- ============================================
-- 1. DEBATE_FEEDBACK TABLE INDEXES
-- ============================================

-- Index for debate_id foreign key
CREATE INDEX IF NOT EXISTS idx_debate_feedback_debate_id 
ON debate_feedback(debate_id);

-- Index for user_id foreign key
CREATE INDEX IF NOT EXISTS idx_debate_feedback_user_id 
ON debate_feedback(user_id);

-- ============================================
-- 2. DEBATES TABLE INDEXES
-- ============================================

-- Index for created_by foreign key
CREATE INDEX IF NOT EXISTS idx_debates_created_by 
ON debates(created_by);

-- ============================================
-- 3. SPEECH_FEEDBACK TABLE INDEXES
-- ============================================

-- Index for debate_id foreign key
CREATE INDEX IF NOT EXISTS idx_speech_feedback_debate_id 
ON speech_feedback(debate_id);

-- Index for recording_id foreign key
CREATE INDEX IF NOT EXISTS idx_speech_feedback_recording_id 
ON speech_feedback(recording_id);

-- ============================================
-- 4. SPEECH_RECORDINGS TABLE INDEXES
-- ============================================

-- Index for debate_id foreign key
CREATE INDEX IF NOT EXISTS idx_speech_recordings_debate_id 
ON speech_recordings(debate_id);

-- Index for user_id foreign key
CREATE INDEX IF NOT EXISTS idx_speech_recordings_user_id 
ON speech_recordings(user_id);

-- ============================================
-- 5. USER_ROLES TABLE INDEXES
-- ============================================

-- Index for granted_by foreign key
CREATE INDEX IF NOT EXISTS idx_user_roles_granted_by 
ON user_roles(granted_by);

-- ============================================
-- 6. DEBATE_SESSIONS TABLE INDEXES
-- ============================================

-- Index for user_id foreign key
CREATE INDEX IF NOT EXISTS idx_debate_sessions_user_id 
ON debate_sessions(user_id);

-- Index for status to speed up queries filtering by status
CREATE INDEX IF NOT EXISTS idx_debate_sessions_status 
ON debate_sessions(status);

-- Composite index for user_id and status (common query pattern)
CREATE INDEX IF NOT EXISTS idx_debate_sessions_user_status 
ON debate_sessions(user_id, status);

-- ============================================
-- 7. PERFORMANCE INDEXES FOR COMMON QUERIES
-- ============================================

-- Index for created_at columns (for sorting and date filtering)
CREATE INDEX IF NOT EXISTS idx_debates_created_at 
ON debates(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_debate_sessions_created_at 
ON debate_sessions(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_speech_feedback_created_at 
ON speech_feedback(created_at DESC);

-- ============================================
-- 8. VERIFY INDEXES WERE CREATED
-- ============================================

-- This query will show all indexes on our tables
-- Run this after applying the migration to verify
/*
SELECT 
    schemaname,
    tablename,
    indexname
FROM pg_indexes
WHERE schemaname = 'public' 
    AND tablename IN (
        'debate_feedback', 
        'debates', 
        'speech_feedback', 
        'speech_recordings', 
        'user_roles',
        'debate_sessions'
    )
ORDER BY tablename, indexname;
*/