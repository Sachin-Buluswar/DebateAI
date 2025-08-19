-- =====================================================
-- POST-FIX VERIFICATION SCRIPT
-- =====================================================
-- Run this after applying permission fixes to verify everything worked
-- and identify any remaining issues

-- =====================================================
-- 1. VERIFY PERMISSIONS WERE APPLIED
-- =====================================================
SELECT '✅ PERMISSION VERIFICATION' as section;

WITH permission_check AS (
    SELECT 
        t.table_name,
        COUNT(DISTINCT p.privilege_type) as privilege_count,
        STRING_AGG(DISTINCT p.grantee, ', ') as grantees,
        STRING_AGG(DISTINCT p.privilege_type, ', ' ORDER BY p.privilege_type) as privileges
    FROM information_schema.tables t
    LEFT JOIN information_schema.table_privileges p
        ON t.table_name = p.table_name 
        AND t.table_schema = p.table_schema
        AND p.grantee IN ('authenticated', 'anon')
    WHERE t.table_schema = 'public'
        AND t.table_type = 'BASE TABLE'
    GROUP BY t.table_name
)
SELECT 
    table_name,
    CASE 
        WHEN privilege_count >= 3 THEN '✅ Fixed'
        WHEN privilege_count > 0 THEN '🟡 Partial'
        ELSE '❌ STILL BROKEN'
    END as status,
    privilege_count || ' permissions' as count,
    privileges
FROM permission_check
ORDER BY 
    CASE 
        WHEN privilege_count = 0 THEN 1
        WHEN privilege_count < 3 THEN 2
        ELSE 3
    END,
    table_name;

-- =====================================================
-- 2. CHECK CRITICAL AUTH TABLES
-- =====================================================
SELECT '🔐 AUTH TABLES STATUS' as section;

SELECT 
    'user_profiles' as table_name,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.table_privileges 
            WHERE table_name = 'user_profiles' 
            AND grantee = 'authenticated' 
            AND privilege_type = 'INSERT'
        ) THEN '✅ Can INSERT (signup works)'
        ELSE '❌ Cannot INSERT (signup broken)'
    END as insert_status,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.table_privileges 
            WHERE table_name = 'user_profiles' 
            AND grantee = 'authenticated' 
            AND privilege_type = 'SELECT'
        ) THEN '✅ Can SELECT (login works)'
        ELSE '❌ Cannot SELECT (login broken)'
    END as select_status,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.table_privileges 
            WHERE table_name = 'user_profiles' 
            AND grantee = 'authenticated' 
            AND privilege_type = 'UPDATE'
        ) THEN '✅ Can UPDATE (profile updates work)'
        ELSE '❌ Cannot UPDATE (profile updates broken)'
    END as update_status;

-- =====================================================
-- 3. CHECK RLS POLICY EFFECTIVENESS
-- =====================================================
SELECT '🔒 RLS POLICY CHECK' as section;

SELECT 
    tablename,
    policyname,
    cmd as operation,
    roles::text as applies_to,
    CASE 
        WHEN permissive = 'PERMISSIVE' THEN '✅ Permissive'
        ELSE '⚠️ Restrictive'
    END as policy_type,
    CASE 
        WHEN qual IS NOT NULL THEN 'Has conditions'
        ELSE 'No conditions'
    END as has_conditions
FROM pg_policies
WHERE schemaname = 'public'
    AND tablename IN ('user_profiles', 'debates', 'speech_feedback', 'debate_sessions')
ORDER BY tablename, cmd;

-- =====================================================
-- 4. CHECK FOR POTENTIAL SECURITY ISSUES
-- =====================================================
SELECT '⚠️ SECURITY CONCERNS' as section;

-- Check for overly permissive policies
SELECT 
    tablename,
    policyname,
    CASE 
        WHEN qual = 'true' OR qual IS NULL THEN '🔴 DANGEROUS: No restrictions!'
        WHEN qual LIKE '%auth.uid()%' THEN '✅ User-scoped'
        ELSE '🟡 Review needed'
    END as security_level,
    cmd as operation,
    qual as condition
FROM pg_policies
WHERE schemaname = 'public'
    AND (qual = 'true' OR qual IS NULL OR qual NOT LIKE '%auth.uid()%')
ORDER BY 
    CASE 
        WHEN qual = 'true' OR qual IS NULL THEN 1
        ELSE 2
    END;

-- =====================================================
-- 5. CHECK SEQUENCE PERMISSIONS
-- =====================================================
SELECT '🔢 SEQUENCE PERMISSIONS' as section;

SELECT 
    sequence_name,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.usage_privileges
            WHERE object_type = 'SEQUENCE'
            AND object_name = s.sequence_name
            AND grantee = 'authenticated'
        ) THEN '✅ Granted'
        ELSE '❌ Missing'
    END as permission_status
FROM information_schema.sequences s
WHERE sequence_schema = 'public'
LIMIT 10;

-- =====================================================
-- 6. SUMMARY REPORT
-- =====================================================
SELECT '📊 SUMMARY REPORT' as section;

WITH summary AS (
    SELECT 
        (SELECT COUNT(*) FROM information_schema.tables 
         WHERE table_schema = 'public' AND table_type = 'BASE TABLE') as total_tables,
        (SELECT COUNT(DISTINCT table_name) FROM information_schema.table_privileges 
         WHERE table_schema = 'public' AND grantee = 'authenticated') as tables_with_auth_perms,
        (SELECT COUNT(DISTINCT table_name) FROM information_schema.table_privileges 
         WHERE table_schema = 'public' AND grantee = 'anon') as tables_with_anon_perms,
        (SELECT COUNT(*) FROM pg_policies WHERE schemaname = 'public') as total_policies,
        (SELECT COUNT(*) FROM pg_class c 
         JOIN pg_namespace n ON n.oid = c.relnamespace 
         WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity) as tables_with_rls
)
SELECT 
    'Tables with authenticated permissions' as metric,
    tables_with_auth_perms || '/' || total_tables as value,
    CASE 
        WHEN tables_with_auth_perms = total_tables THEN '✅ All covered'
        WHEN tables_with_auth_perms > 0 THEN '🟡 Partial coverage'
        ELSE '❌ None'
    END as status
FROM summary
UNION ALL
SELECT 
    'Tables with anon permissions' as metric,
    tables_with_anon_perms || '/' || total_tables as value,
    CASE 
        WHEN tables_with_anon_perms > 0 THEN '✅ Has public access'
        ELSE '⚠️ No public access'
    END as status
FROM summary
UNION ALL
SELECT 
    'Tables with RLS enabled' as metric,
    tables_with_rls || '/' || total_tables as value,
    CASE 
        WHEN tables_with_rls = total_tables THEN '✅ All protected'
        ELSE '🟡 Some unprotected'
    END as status
FROM summary
UNION ALL
SELECT 
    'Total RLS policies' as metric,
    total_policies::text as value,
    CASE 
        WHEN total_policies > 0 THEN '✅ Has policies'
        ELSE '❌ No policies'
    END as status
FROM summary;

-- =====================================================
-- 7. NEXT STEPS
-- =====================================================
SELECT '➡️ RECOMMENDED NEXT STEPS' as section;

SELECT 
    priority,
    action,
    reason
FROM (VALUES
    (1, 'Test user signup/login immediately', 'Verify auth is working'),
    (2, 'Test creating a debate', 'Verify core features work'),
    (3, 'Check browser console for errors', 'Identify client-side issues'),
    (4, 'Review service role key usage', '97 files using it = security risk'),
    (5, 'Audit API routes for proper auth', 'Many routes bypass auth checks'),
    (6, 'Sync local and remote migrations', 'Database has future-dated migrations'),
    (7, 'Remove service role from client code', 'Critical security vulnerability')
) AS steps(priority, action, reason)
ORDER BY priority;