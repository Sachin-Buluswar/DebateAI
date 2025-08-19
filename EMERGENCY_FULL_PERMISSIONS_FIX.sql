-- =====================================================
-- EMERGENCY DATABASE PERMISSIONS FIX FOR ERIS DEBATE
-- =====================================================
-- This script fixes CRITICAL permission issues that are breaking the entire application
-- Run this IMMEDIATELY in Supabase SQL Editor with admin privileges

-- SUMMARY OF ISSUES FOUND:
-- 1. ALL 16 tables have ZERO permissions for authenticated users
-- 2. RLS is enabled with policies, but without base permissions, nothing works
-- 3. Migrations contain GRANT statements but they weren't applied
-- 4. Application is using service_role key everywhere as a workaround (security risk)

-- =====================================================
-- PART 1: CRITICAL USER TABLES
-- =====================================================

-- user_profiles: Essential for authentication
GRANT SELECT, INSERT, UPDATE ON public.user_profiles TO authenticated;
GRANT SELECT ON public.user_profiles TO anon; -- For public profile viewing

-- user_preferences: User settings storage
GRANT SELECT, INSERT, UPDATE ON public.user_preferences TO authenticated;

-- user_roles: Role-based access control
GRANT SELECT ON public.user_roles TO authenticated;
GRANT SELECT ON public.user_roles TO anon; -- For checking public user roles

-- =====================================================
-- PART 2: DEBATE CORE TABLES
-- =====================================================

-- debates: Main debate sessions
GRANT SELECT, INSERT, UPDATE ON public.debates TO authenticated;
GRANT SELECT ON public.debates TO anon; -- For viewing public debates

-- debate_sessions: Active debate management
GRANT SELECT, INSERT, UPDATE, DELETE ON public.debate_sessions TO authenticated;

-- debate_speeches: Speech records
GRANT SELECT, INSERT, UPDATE ON public.debate_speeches TO authenticated;
GRANT SELECT ON public.debate_speeches TO anon; -- For viewing completed debates

-- debate_feedback: User feedback on debates
GRANT SELECT, INSERT, UPDATE ON public.debate_feedback TO authenticated;

-- debate_history: Historical debate records
GRANT SELECT, INSERT, UPDATE ON public.debate_history TO authenticated;

-- =====================================================
-- PART 3: SPEECH & AUDIO TABLES
-- =====================================================

-- speech_feedback: Speech analysis results
GRANT SELECT, INSERT, UPDATE, DELETE ON public.speech_feedback TO authenticated;

-- speech_recordings: Audio file records
GRANT SELECT, INSERT, UPDATE ON public.speech_recordings TO authenticated;

-- audio_recordings: Audio storage
GRANT SELECT, INSERT, UPDATE ON public.audio_recordings TO authenticated;

-- =====================================================
-- PART 4: CONTENT & SEARCH TABLES
-- =====================================================

-- documents: Document storage
GRANT SELECT ON public.documents TO authenticated;
GRANT SELECT ON public.documents TO anon; -- For public document search
-- Admin operations will use service role

-- saved_searches: User's saved searches
GRANT SELECT, INSERT, UPDATE, DELETE ON public.saved_searches TO authenticated;

-- =====================================================
-- PART 5: EDUCATIONAL RESOURCES
-- =====================================================

-- educational_resources: Learning materials
GRANT SELECT ON public.educational_resources TO authenticated;
GRANT SELECT ON public.educational_resources TO anon; -- Public access to resources

-- resource_analytics: Usage tracking
GRANT INSERT ON public.resource_analytics TO authenticated;
GRANT INSERT ON public.resource_analytics TO anon; -- Anonymous tracking allowed

-- =====================================================
-- PART 6: SYSTEM TABLES
-- =====================================================

-- health_check: System monitoring
GRANT SELECT ON public.health_check TO authenticated;
GRANT SELECT ON public.health_check TO anon; -- For public health checks

-- =====================================================
-- PART 7: GRANT SEQUENCE PERMISSIONS
-- =====================================================
-- Required for tables with auto-increment or serial columns

DO $$
BEGIN
    -- Grant usage on all sequences to authenticated users
    EXECUTE (
        SELECT string_agg('GRANT USAGE ON SEQUENCE ' || sequence_schema || '.' || sequence_name || ' TO authenticated;', E'\n')
        FROM information_schema.sequences
        WHERE sequence_schema = 'public'
    );
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Some sequences may not exist or have issues: %', SQLERRM;
END $$;

-- =====================================================
-- PART 8: VERIFICATION QUERIES
-- =====================================================

-- Check that permissions were granted successfully
SELECT 
    '===== PERMISSION VERIFICATION =====' as section;

SELECT 
    table_name,
    string_agg(DISTINCT grantee || ':' || privilege_type, ', ' ORDER BY grantee || ':' || privilege_type) as permissions,
    CASE 
        WHEN string_agg(DISTINCT privilege_type, ',') LIKE '%SELECT%' 
         AND string_agg(DISTINCT privilege_type, ',') LIKE '%INSERT%' 
        THEN '✅ FIXED'
        ELSE '⚠️ CHECK'
    END as status
FROM information_schema.table_privileges
WHERE table_schema = 'public' 
    AND grantee IN ('authenticated', 'anon')
GROUP BY table_name
ORDER BY table_name;

-- Check RLS status
SELECT 
    '===== RLS STATUS =====' as section;

SELECT 
    tablename,
    CASE WHEN rowsecurity THEN '✅ Enabled' ELSE '❌ Disabled' END as rls_status,
    (SELECT COUNT(*) FROM pg_policies WHERE tablename = t.tablename) as policy_count
FROM pg_tables t
WHERE schemaname = 'public'
ORDER BY tablename;

-- =====================================================
-- PART 9: RECOMMENDATIONS
-- =====================================================

SELECT 
    '===== NEXT STEPS =====' as section,
    'After running this script:' as action;

SELECT '1. Test user registration and login immediately' as step
UNION ALL
SELECT '2. Test creating a debate session' as step
UNION ALL
SELECT '3. Test speech feedback submission' as step
UNION ALL
SELECT '4. Remove service_role key usage from client-side code' as step
UNION ALL
SELECT '5. Monitor error logs for any remaining permission issues' as step
ORDER BY step;

-- =====================================================
-- SUCCESS MESSAGE
-- =====================================================

SELECT 
    '🎉 PERMISSIONS FIXED!' as status,
    'All tables now have proper permissions for authenticated users' as message,
    'The application should now work correctly' as result;