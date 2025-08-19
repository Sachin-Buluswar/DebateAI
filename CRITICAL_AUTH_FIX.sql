-- CRITICAL AUTH FIX - Missing Table Permissions
-- This is THE fix for "authentication_failed" errors
-- Run this IMMEDIATELY in Supabase SQL Editor

-- THE PROBLEM: authenticated role has NO permissions on user_profiles table!
-- Even with RLS policies, users can't do anything without base permissions

-- Step 1: Grant essential permissions to authenticated users
GRANT SELECT, INSERT, UPDATE ON public.user_profiles TO authenticated;

-- Step 2: Also grant to anon for public profile viewing (optional but recommended)
GRANT SELECT ON public.user_profiles TO anon;

-- Step 3: Verify permissions were granted
SELECT 
    grantee,
    privilege_type
FROM information_schema.table_privileges
WHERE table_schema = 'public' 
    AND table_name = 'user_profiles'
    AND grantee IN ('authenticated', 'anon')
ORDER BY grantee, privilege_type;

-- Expected output should show:
-- authenticated | INSERT
-- authenticated | SELECT  
-- authenticated | UPDATE
-- anon         | SELECT

-- If the above query returns results, AUTH WILL WORK!