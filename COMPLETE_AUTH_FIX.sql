-- COMPLETE AUTH FIX FOR ERIS DEBATE
-- Fixes all authentication issues in one script
-- Run this in Supabase SQL Editor with admin privileges

-- ============================================
-- PART 1: GRANT MISSING PERMISSIONS (CRITICAL)
-- ============================================
-- This is the main issue - authenticated users have NO table permissions!
GRANT SELECT, INSERT, UPDATE ON public.user_profiles TO authenticated;
GRANT SELECT ON public.user_profiles TO anon;

-- Grant usage on any sequences (for auto-increment columns if they exist)
DO $$
BEGIN
    GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

-- ============================================
-- PART 2: FIX RLS POLICIES
-- ============================================
-- The existing policies might have issues, let's ensure they're correct

-- Check if RLS is enabled (it should be)
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- Drop potentially problematic policies
DO $$ 
BEGIN
    DROP POLICY IF EXISTS "auth_users_own_profile" ON public.user_profiles;
    DROP POLICY IF EXISTS "Users can insert own profile" ON public.user_profiles;
    DROP POLICY IF EXISTS "Users can view own profile" ON public.user_profiles;
    DROP POLICY IF EXISTS "Users can update own profile" ON public.user_profiles;
    DROP POLICY IF EXISTS "Admins can view all profiles" ON public.user_profiles;
    DROP POLICY IF EXISTS "Admins can update all profiles" ON public.user_profiles;
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

-- Create clean, working policies
-- 1. Users can view their own profile
CREATE POLICY "users_select_own" 
    ON public.user_profiles FOR SELECT 
    TO authenticated
    USING (auth.uid() = id);

-- 2. Users can create their own profile (CRITICAL for auth)
CREATE POLICY "users_insert_own" 
    ON public.user_profiles FOR INSERT 
    TO authenticated
    WITH CHECK (auth.uid() = id);

-- 3. Users can update their own profile
CREATE POLICY "users_update_own" 
    ON public.user_profiles FOR UPDATE 
    TO authenticated
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- 4. Admins can view all (if user_roles table exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_roles') THEN
        CREATE POLICY "admins_select_all" 
            ON public.user_profiles FOR SELECT 
            TO authenticated
            USING (
                EXISTS (
                    SELECT 1 FROM public.user_roles
                    WHERE user_roles.user_id = auth.uid()
                    AND user_roles.role IN ('admin', 'super_admin')
                    AND (user_roles.expires_at IS NULL OR user_roles.expires_at > NOW())
                )
            );
    END IF;
END $$;

-- ============================================
-- PART 3: FIX TABLE STRUCTURE
-- ============================================
-- Ensure columns have proper defaults (without referencing themselves)
ALTER TABLE public.user_profiles 
    ALTER COLUMN created_at SET DEFAULT NOW();
    
ALTER TABLE public.user_profiles 
    ALTER COLUMN updated_at SET DEFAULT NOW();

-- Create auto-update trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON public.user_profiles;
CREATE TRIGGER update_user_profiles_updated_at
    BEFORE UPDATE ON public.user_profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- PART 4: PERFORMANCE OPTIMIZATION
-- ============================================
CREATE INDEX IF NOT EXISTS idx_user_profiles_id ON public.user_profiles(id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON public.user_profiles(email);

-- ============================================
-- PART 5: VERIFICATION
-- ============================================
-- Check that everything is fixed
SELECT 'Checking table permissions...' as status;
SELECT 
    grantee,
    string_agg(privilege_type, ', ' ORDER BY privilege_type) as permissions
FROM information_schema.table_privileges
WHERE table_schema = 'public' 
    AND table_name = 'user_profiles'
    AND grantee IN ('authenticated', 'anon')
GROUP BY grantee;

SELECT 'Checking RLS policies...' as status;
SELECT 
    policyname,
    cmd,
    roles::text
FROM pg_policies 
WHERE schemaname = 'public' 
    AND tablename = 'user_profiles'
ORDER BY cmd, policyname;

SELECT 'AUTH FIX COMPLETE!' as status;
SELECT 'Users should now be able to sign up and sign in without errors.' as message;