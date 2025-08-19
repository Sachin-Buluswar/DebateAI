-- Production-Ready Auth Fix for Supabase
-- Run this in Supabase SQL Editor to fix authentication issues

-- Step 1: Clean up existing policies
DO $$ 
BEGIN
    -- Drop all existing user_profiles policies
    DROP POLICY IF EXISTS "Users can view their own profile" ON public.user_profiles;
    DROP POLICY IF EXISTS "Users can insert their own profile" ON public.user_profiles;
    DROP POLICY IF EXISTS "Users can update their own profile" ON public.user_profiles;
    DROP POLICY IF EXISTS "Service role can manage all profiles" ON public.user_profiles;
    DROP POLICY IF EXISTS "users_view_own_profile" ON public.user_profiles;
    DROP POLICY IF EXISTS "users_create_own_profile" ON public.user_profiles;
    DROP POLICY IF EXISTS "users_update_own_profile" ON public.user_profiles;
    DROP POLICY IF EXISTS "service_role_all_access" ON public.user_profiles;
EXCEPTION
    WHEN OTHERS THEN
        -- Continue even if some policies don't exist
        NULL;
END $$;

-- Step 2: Create correct RLS policies
-- Allow users to view their own profile
CREATE POLICY "users_view_own_profile" 
    ON public.user_profiles 
    FOR SELECT 
    USING (auth.uid() = id);

-- CRITICAL: Allow users to create their own profile during signup
CREATE POLICY "users_create_own_profile" 
    ON public.user_profiles 
    FOR INSERT 
    WITH CHECK (auth.uid() = id);

-- Allow users to update their own profile
CREATE POLICY "users_update_own_profile" 
    ON public.user_profiles 
    FOR UPDATE 
    USING (auth.uid() = id);

-- Step 3: Grant permissions to authenticated role
GRANT SELECT, INSERT, UPDATE ON public.user_profiles TO authenticated;

-- Step 4: Fix column defaults (corrected - no column references)
DO $$
BEGIN
    -- Only set defaults if they don't already exist
    ALTER TABLE public.user_profiles 
        ALTER COLUMN created_at SET DEFAULT NOW();
    ALTER TABLE public.user_profiles 
        ALTER COLUMN updated_at SET DEFAULT NOW();
EXCEPTION
    WHEN OTHERS THEN
        -- Ignore if defaults already exist
        NULL;
END $$;

-- Step 5: Create or replace the auto-update trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 6: Ensure trigger exists
DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON public.user_profiles;
CREATE TRIGGER update_user_profiles_updated_at
    BEFORE UPDATE ON public.user_profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Step 7: Create index for performance
CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON public.user_profiles(email);

-- Step 8: Add documentation
COMMENT ON TABLE public.user_profiles IS 'User profiles with fixed RLS policies for auth callback';

-- Step 9: Verify the fix worked
SELECT 
    tablename,
    policyname,
    cmd,
    permissive,
    roles
FROM pg_policies 
WHERE schemaname = 'public' 
    AND tablename = 'user_profiles'
ORDER BY policyname;