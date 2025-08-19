-- EMERGENCY AUTH FIX - Minimal changes to restore authentication
-- Run this if users are getting "authentication_failed" errors RIGHT NOW

-- The root cause: Users can't create their own profiles during auth callback
-- This single policy change should fix 90% of auth issues

-- Drop the problematic policy if it exists
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.user_profiles;

-- Create a permissive INSERT policy that allows users to create their own profile
CREATE POLICY "users_create_own_profile" 
    ON public.user_profiles 
    FOR INSERT 
    WITH CHECK (auth.uid() = id);

-- Ensure authenticated users have INSERT permission
GRANT INSERT ON public.user_profiles TO authenticated;

-- Quick verification
SELECT 
    policyname,
    cmd,
    with_check
FROM pg_policies 
WHERE tablename = 'user_profiles' 
    AND cmd = 'INSERT';