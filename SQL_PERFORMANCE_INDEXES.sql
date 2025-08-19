-- =====================================================
-- PERFORMANCE OPTIMIZATION - MISSING INDEXES
-- =====================================================
-- Run this to add critical missing indexes for better query performance
-- These indexes are essential for foreign key lookups and common queries

-- =====================================================
-- 1. USER-RELATED INDEXES
-- =====================================================

-- user_profiles - Critical for auth lookups
CREATE INDEX IF NOT EXISTS idx_user_profiles_id ON public.user_profiles(id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON public.user_profiles(email);
CREATE INDEX IF NOT EXISTS idx_user_profiles_updated_at ON public.user_profiles(updated_at DESC);

-- user_preferences - Fast preference lookups
CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id ON public.user_preferences(user_id);

-- user_roles - Critical for permission checks
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON public.user_roles(role);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_role ON public.user_roles(user_id, role);

-- =====================================================
-- 2. DEBATE-RELATED INDEXES
-- =====================================================

-- debates - Main debate queries
CREATE INDEX IF NOT EXISTS idx_debates_created_by ON public.debates(created_by);
CREATE INDEX IF NOT EXISTS idx_debates_status ON public.debates(status);
CREATE INDEX IF NOT EXISTS idx_debates_created_at ON public.debates(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_debates_topic ON public.debates(topic);

-- debate_sessions - Active session lookups
CREATE INDEX IF NOT EXISTS idx_debate_sessions_user_id ON public.debate_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_debate_sessions_status ON public.debate_sessions(status);
CREATE INDEX IF NOT EXISTS idx_debate_sessions_created_at ON public.debate_sessions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_debate_sessions_topic ON public.debate_sessions(topic);

-- debate_speeches - Speech history
CREATE INDEX IF NOT EXISTS idx_debate_speeches_session_id ON public.debate_speeches(session_id);
CREATE INDEX IF NOT EXISTS idx_debate_speeches_speaker_id ON public.debate_speeches(speaker_id);
CREATE INDEX IF NOT EXISTS idx_debate_speeches_timestamp ON public.debate_speeches(timestamp DESC);

-- debate_feedback - User feedback queries
CREATE INDEX IF NOT EXISTS idx_debate_feedback_debate_id ON public.debate_feedback(debate_id);
CREATE INDEX IF NOT EXISTS idx_debate_feedback_user_id ON public.debate_feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_debate_feedback_created_at ON public.debate_feedback(created_at DESC);

-- debate_history - Historical queries
CREATE INDEX IF NOT EXISTS idx_debate_history_user_id ON public.debate_history(user_id);
CREATE INDEX IF NOT EXISTS idx_debate_history_created_at ON public.debate_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_debate_history_type ON public.debate_history(type);

-- =====================================================
-- 3. SPEECH & AUDIO INDEXES
-- =====================================================

-- speech_feedback - Critical for feedback queries
CREATE INDEX IF NOT EXISTS idx_speech_feedback_user_id ON public.speech_feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_speech_feedback_created_at ON public.speech_feedback(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_speech_feedback_debate_id ON public.speech_feedback(debate_id);
CREATE INDEX IF NOT EXISTS idx_speech_feedback_overall_score ON public.speech_feedback(overall_score DESC);
CREATE INDEX IF NOT EXISTS idx_speech_feedback_skill_level ON public.speech_feedback(skill_level);

-- speech_recordings - Audio lookups
CREATE INDEX IF NOT EXISTS idx_speech_recordings_user_id ON public.speech_recordings(user_id);
CREATE INDEX IF NOT EXISTS idx_speech_recordings_debate_id ON public.speech_recordings(debate_id);
CREATE INDEX IF NOT EXISTS idx_speech_recordings_created_at ON public.speech_recordings(created_at DESC);

-- audio_recordings - Session audio
CREATE INDEX IF NOT EXISTS idx_audio_recordings_session_id ON public.audio_recordings(session_id);
CREATE INDEX IF NOT EXISTS idx_audio_recordings_speaker_id ON public.audio_recordings(speaker_id);
CREATE INDEX IF NOT EXISTS idx_audio_recordings_created_at ON public.audio_recordings(created_at DESC);

-- =====================================================
-- 4. CONTENT & SEARCH INDEXES
-- =====================================================

-- documents - Search performance
CREATE INDEX IF NOT EXISTS idx_documents_user_id ON public.documents(user_id);
CREATE INDEX IF NOT EXISTS idx_documents_source_type ON public.documents(source_type);
CREATE INDEX IF NOT EXISTS idx_documents_created_at ON public.documents(created_at DESC);
-- Full text search index
CREATE INDEX IF NOT EXISTS idx_documents_search_vector ON public.documents USING gin(search_vector);

-- saved_searches - User search history
CREATE INDEX IF NOT EXISTS idx_saved_searches_user_id ON public.saved_searches(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_searches_created_at ON public.saved_searches(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_saved_searches_query ON public.saved_searches(query);

-- =====================================================
-- 5. EDUCATIONAL RESOURCES INDEXES
-- =====================================================

-- educational_resources - Resource queries
CREATE INDEX IF NOT EXISTS idx_educational_resources_category ON public.educational_resources(category);
CREATE INDEX IF NOT EXISTS idx_educational_resources_slug ON public.educational_resources(slug);
CREATE INDEX IF NOT EXISTS idx_educational_resources_is_published ON public.educational_resources(is_published);
CREATE INDEX IF NOT EXISTS idx_educational_resources_is_featured ON public.educational_resources(is_featured);
CREATE INDEX IF NOT EXISTS idx_educational_resources_difficulty ON public.educational_resources(difficulty);

-- resource_analytics - Analytics queries
CREATE INDEX IF NOT EXISTS idx_resource_analytics_resource_id ON public.resource_analytics(resource_id);
CREATE INDEX IF NOT EXISTS idx_resource_analytics_user_id ON public.resource_analytics(user_id);
CREATE INDEX IF NOT EXISTS idx_resource_analytics_event_type ON public.resource_analytics(event_type);
CREATE INDEX IF NOT EXISTS idx_resource_analytics_created_at ON public.resource_analytics(created_at DESC);

-- =====================================================
-- 6. COMPOSITE INDEXES FOR COMMON QUERIES
-- =====================================================

-- Common user activity queries
CREATE INDEX IF NOT EXISTS idx_speech_feedback_user_date 
    ON public.speech_feedback(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_debate_sessions_user_status 
    ON public.debate_sessions(user_id, status);

CREATE INDEX IF NOT EXISTS idx_saved_searches_user_date 
    ON public.saved_searches(user_id, created_at DESC);

-- Admin dashboard queries
CREATE INDEX IF NOT EXISTS idx_debates_status_date 
    ON public.debates(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_speech_feedback_score_date 
    ON public.speech_feedback(overall_score DESC, created_at DESC);

-- =====================================================
-- 7. VERIFICATION
-- =====================================================

-- Check that indexes were created
SELECT 
    schemaname,
    tablename,
    indexname,
    CASE 
        WHEN indexname LIKE 'idx_%' THEN '✅ Custom index'
        WHEN indexname LIKE '%_pkey' THEN '🔑 Primary key'
        ELSE '📊 System index'
    END as index_type
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;

-- Count indexes per table
SELECT 
    tablename,
    COUNT(*) as index_count,
    STRING_AGG(indexname, ', ') as indexes
FROM pg_indexes
WHERE schemaname = 'public'
GROUP BY tablename
ORDER BY index_count DESC;

-- =====================================================
-- 8. ANALYZE TABLES FOR OPTIMIZER
-- =====================================================
-- Update statistics for query planner

ANALYZE public.user_profiles;
ANALYZE public.user_preferences;
ANALYZE public.user_roles;
ANALYZE public.debates;
ANALYZE public.debate_sessions;
ANALYZE public.debate_speeches;
ANALYZE public.debate_feedback;
ANALYZE public.debate_history;
ANALYZE public.speech_feedback;
ANALYZE public.speech_recordings;
ANALYZE public.audio_recordings;
ANALYZE public.documents;
ANALYZE public.saved_searches;
ANALYZE public.educational_resources;
ANALYZE public.resource_analytics;
ANALYZE public.health_check;

SELECT '✅ INDEXES CREATED AND STATISTICS UPDATED' as status,
       'Performance should be significantly improved' as message;