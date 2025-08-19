-- =====================================================
-- DATABASE STATUS CHECK - Run this FIRST
-- =====================================================
-- This script diagnoses all permission and configuration issues
-- Run in Supabase SQL Editor to see what's broken

-- =====================================================
-- 1. CHECK TABLE PERMISSIONS
-- =====================================================
SELECT 
    '🔍 TABLE PERMISSIONS CHECK' as check_type,
    '' as details;

SELECT 
    t.table_name,
    CASE 
        WHEN p.grantee IS NULL THEN '❌ NO PERMISSIONS AT ALL'
        WHEN p.privilege_type NOT LIKE '%SELECT%' THEN '🟡 Missing SELECT'
        WHEN p.privilege_type NOT LIKE '%INSERT%' THEN '🟡 Missing INSERT'
        ELSE '✅ Has some permissions'
    END as status,
    COALESCE(
        STRING_AGG(DISTINCT p.grantee || ':' || p.privilege_type, ', '),
        'NONE'
    ) as current_permissions
FROM information_schema.tables t
LEFT JOIN information_schema.table_privileges p
    ON t.table_name = p.table_name 
    AND t.table_schema = p.table_schema
    AND p.grantee IN ('authenticated', 'anon', 'public')
WHERE t.table_schema = 'public'
    AND t.table_type = 'BASE TABLE'
GROUP BY t.table_name, p.grantee, p.privilege_type
ORDER BY 
    CASE 
        WHEN p.grantee IS NULL THEN 1
        ELSE 2
    END,
    t.table_name;

-- =====================================================
-- 2. CHECK RLS STATUS
-- =====================================================
SELECT 
    '🔒 ROW LEVEL SECURITY CHECK' as check_type,
    '' as details;

SELECT 
    c.relname as table_name,
    CASE 
        WHEN c.relrowsecurity THEN '✅ RLS Enabled'
        ELSE '❌ RLS Disabled'
    END as rls_status,
    COUNT(p.policyname) as policy_count,
    CASE 
        WHEN c.relrowsecurity AND COUNT(p.policyname) = 0 THEN '🔴 RLS ON but NO policies!'
        WHEN c.relrowsecurity AND COUNT(p.policyname) > 0 THEN '✅ Has policies'
        ELSE '⚠️ No RLS'
    END as assessment
FROM pg_class c
LEFT JOIN pg_policies p 
    ON c.relname = p.tablename 
    AND p.schemaname = 'public'
WHERE c.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    AND c.relkind = 'r'
GROUP BY c.relname, c.relrowsecurity
ORDER BY c.relname;

-- =====================================================
-- 3. CHECK CRITICAL TABLES FOR AUTH
-- =====================================================
SELECT 
    '🔐 AUTHENTICATION TABLES CHECK' as check_type,
    '' as details;

WITH auth_tables AS (
    SELECT 
        'user_profiles' as table_name,
        (SELECT COUNT(*) FROM information_schema.table_privileges 
         WHERE table_name = 'user_profiles' 
         AND grantee = 'authenticated' 
         AND privilege_type = 'INSERT') as has_insert,
        (SELECT COUNT(*) FROM information_schema.table_privileges 
         WHERE table_name = 'user_profiles' 
         AND grantee = 'authenticated' 
         AND privilege_type = 'SELECT') as has_select,
        (SELECT COUNT(*) FROM information_schema.table_privileges 
         WHERE table_name = 'user_profiles' 
         AND grantee = 'authenticated' 
         AND privilege_type = 'UPDATE') as has_update
)
SELECT 
    table_name,
    CASE 
        WHEN has_insert = 0 THEN '❌ Cannot CREATE profiles (auth will fail!)'
        WHEN has_select = 0 THEN '❌ Cannot READ profiles'
        WHEN has_update = 0 THEN '⚠️ Cannot UPDATE profiles'
        ELSE '✅ Permissions OK'
    END as auth_status,
    'INSERT: ' || CASE WHEN has_insert > 0 THEN '✅' ELSE '❌' END ||
    ', SELECT: ' || CASE WHEN has_select > 0 THEN '✅' ELSE '❌' END ||
    ', UPDATE: ' || CASE WHEN has_update > 0 THEN '✅' ELSE '❌' END as permissions
FROM auth_tables;

-- =====================================================
-- 4. COUNT TOTAL PERMISSIONS
-- =====================================================
SELECT 
    '📊 PERMISSION STATISTICS' as check_type,
    '' as details;

SELECT 
    grantee,
    COUNT(DISTINCT table_name) as tables_with_permissions,
    COUNT(DISTINCT privilege_type) as unique_privileges,
    STRING_AGG(DISTINCT privilege_type, ', ') as privilege_types
FROM information_schema.table_privileges
WHERE table_schema = 'public'
    AND grantee IN ('authenticated', 'anon', 'public')
GROUP BY grantee

UNION ALL

SELECT 
    'TOTAL TABLES' as grantee,
    COUNT(*) as tables_with_permissions,
    0 as unique_privileges,
    'All tables in public schema' as privilege_types
FROM information_schema.tables
WHERE table_schema = 'public'
    AND table_type = 'BASE TABLE';

-- =====================================================
-- 5. CHECK MIGRATIONS
-- =====================================================
SELECT 
    '📦 MIGRATION CHECK' as check_type,
    '' as details;

SELECT 
    schemaname,
    tablename,
    'Applied migrations in database' as status
FROM pg_tables
WHERE tablename = 'schema_migrations'
LIMIT 1;

-- =====================================================
-- 6. DIAGNOSIS SUMMARY
-- =====================================================
SELECT 
    '🏁 DIAGNOSIS SUMMARY' as check_type,
    '' as details;

WITH permission_summary AS (
    SELECT 
        COUNT(DISTINCT t.table_name) as total_tables,
        COUNT(DISTINCT p.table_name) as tables_with_permissions
    FROM information_schema.tables t
    LEFT JOIN information_schema.table_privileges p
        ON t.table_name = p.table_name 
        AND t.table_schema = p.table_schema
        AND p.grantee IN ('authenticated', 'anon')
    WHERE t.table_schema = 'public'
        AND t.table_type = 'BASE TABLE'
)
SELECT 
    CASE 
        WHEN tables_with_permissions = 0 THEN '🔴 CRITICAL: No tables have permissions!'
        WHEN tables_with_permissions < total_tables THEN '🟡 WARNING: Some tables lack permissions'
        ELSE '✅ All tables have permissions'
    END as overall_status,
    tables_with_permissions || '/' || total_tables as tables_with_permissions,
    CASE 
        WHEN tables_with_permissions = 0 THEN 'Run QUICK_FIX_ALL_PERMISSIONS.sql immediately!'
        WHEN tables_with_permissions < total_tables THEN 'Run EMERGENCY_FULL_PERMISSIONS_FIX.sql'
        ELSE 'Permissions look good'
    END as recommended_action
FROM permission_summary;

-- =====================================================
-- 7. NEXT STEPS
-- =====================================================
SELECT 
    '➡️ NEXT STEPS' as check_type,
    CASE 
        WHEN (SELECT COUNT(*) FROM information_schema.table_privileges 
              WHERE grantee = 'authenticated' AND table_schema = 'public') = 0
        THEN 'RUN QUICK_FIX_ALL_PERMISSIONS.sql IMMEDIATELY!'
        ELSE 'Review the results above for specific issues'
    END as action;