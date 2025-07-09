-- Check for RLS bypass issues

-- 1. Check if any tables have RLS disabled
SELECT 
    schemaname,
    tablename,
    rowsecurity,
    CASE 
        WHEN rowsecurity = false THEN '❌ RLS DISABLED - CRITICAL!'
        ELSE '✅ RLS Enabled'
    END as status
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

-- 2. List ALL policies with their definitions
SELECT 
    schemaname,
    tablename,
    policyname,
    cmd as operation,
    permissive,
    roles,
    qual as using_clause,
    with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- 3. Check for any policies that might be allowing public access
SELECT 
    tablename,
    policyname,
    cmd,
    qual
FROM pg_policies
WHERE schemaname = 'public'
AND (
    qual LIKE '%true%' 
    OR qual IS NULL
    OR qual = ''
    OR roles && ARRAY['anon']::name[]
);

-- 4. Check if there are any GRANT statements allowing public access
SELECT 
    grantee,
    table_schema,
    table_name,
    privilege_type
FROM information_schema.table_privileges
WHERE table_schema = 'public'
AND grantee IN ('PUBLIC', 'anon', 'authenticated')
AND table_name IN (
    'user_profiles',
    'debate_sessions',
    'debate_speeches',
    'speech_feedback',
    'saved_searches',
    'user_preferences',
    'audio_recordings'
)
ORDER BY table_name, grantee, privilege_type;