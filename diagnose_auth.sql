-- DIAGNOSE AUTH ISSUES
-- Run this to see exactly what's wrong with authentication

-- 1. Check if user_profiles table exists
SELECT 
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_profiles')
        THEN '✅ Table exists'
        ELSE '❌ Table missing!'
    END as "user_profiles table";

-- 2. Check if RLS is enabled
SELECT 
    CASE 
        WHEN relrowsecurity 
        THEN '✅ RLS is enabled'
        ELSE '❌ RLS is disabled!'
    END as "Row Level Security"
FROM pg_class
WHERE relname = 'user_profiles';

-- 3. Check table permissions (THIS IS USUALLY THE PROBLEM!)
SELECT 
    CASE 
        WHEN COUNT(*) > 0 
        THEN '✅ Permissions exist: ' || string_agg(grantee || '=' || privilege_type, ', ')
        ELSE '❌ NO PERMISSIONS GRANTED!'
    END as "Table Permissions"
FROM information_schema.table_privileges
WHERE table_schema = 'public' 
    AND table_name = 'user_profiles'
    AND grantee IN ('authenticated', 'anon');

-- 4. Check INSERT policies specifically
SELECT 
    CASE 
        WHEN COUNT(*) > 0 
        THEN '✅ INSERT policy exists: ' || string_agg(policyname, ', ')
        ELSE '❌ No INSERT policy!'
    END as "INSERT Policies"
FROM pg_policies 
WHERE schemaname = 'public' 
    AND tablename = 'user_profiles'
    AND cmd = 'INSERT';

-- 5. Check column defaults
SELECT 
    column_name,
    CASE 
        WHEN column_default IS NOT NULL 
        THEN '✅ Has default: ' || column_default
        ELSE '⚠️  No default'
    END as "Column Default"
FROM information_schema.columns
WHERE table_schema = 'public' 
    AND table_name = 'user_profiles'
    AND column_name IN ('created_at', 'updated_at');

-- 6. Test if authenticated user could insert
SELECT 
    '🔍 To test auth: Try signing up with a new email' as "Next Step",
    '📝 If it fails, run CRITICAL_AUTH_FIX.sql' as "Solution";