-- Emergency Auth Fix - Apply directly to Supabase
-- Run this in Supabase SQL Editor with database owner permissions

-- Fix user_profiles RLS policies to allow auth callback to work properly
-- First, drop existing problematic policies
DO $$ 
BEGIN
    -- Drop policies if they exist
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
        RAISE NOTICE 'Some policies did not exist, continuing...';
END $$;

-- Create new permissive policies for user profiles
CREATE POLICY "users_view_own_profile" 
  ON public.user_profiles 
  FOR SELECT 
  USING (auth.uid() = id);

-- Critical: Allow authenticated users to create their own profile during signup
CREATE POLICY "users_create_own_profile" 
  ON public.user_profiles 
  FOR INSERT 
  WITH CHECK (auth.uid() = id);

-- Allow users to update their own profile
CREATE POLICY "users_update_own_profile" 
  ON public.user_profiles 
  FOR UPDATE 
  USING (auth.uid() = id);

-- Grant necessary permissions to authenticated users
GRANT SELECT, INSERT, UPDATE ON public.user_profiles TO authenticated;

-- Ensure the table has proper defaults (safe to run multiple times)
ALTER TABLE public.user_profiles 
  ALTER COLUMN created_at SET DEFAULT COALESCE(created_at, NOW()),
  ALTER COLUMN updated_at SET DEFAULT COALESCE(updated_at, NOW());

-- Create or replace the trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop and recreate trigger
DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON public.user_profiles;
CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create index if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON public.user_profiles(email);

-- Add helpful comment
COMMENT ON TABLE public.user_profiles IS 'User profiles with fixed RLS - allows auth callback profile creation';

-- Verify the fix by checking policies
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'user_profiles'
ORDER BY policyname;