-- Fix user_profiles RLS policies to allow auth callback to work properly
-- This migration addresses authentication failures caused by RLS policy restrictions

-- First, drop existing policies to recreate them
DROP POLICY IF EXISTS "Users can view their own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Service role can manage all profiles" ON public.user_profiles;

-- Create more permissive policies for user profiles
-- Allow users to view their own profile
CREATE POLICY "users_view_own_profile" 
  ON public.user_profiles 
  FOR SELECT 
  USING (auth.uid() = id);

-- Allow authenticated users to create their own profile during signup
-- This is critical for auth callback to work
CREATE POLICY "users_create_own_profile" 
  ON public.user_profiles 
  FOR INSERT 
  WITH CHECK (auth.uid() = id);

-- Allow users to update their own profile
CREATE POLICY "users_update_own_profile" 
  ON public.user_profiles 
  FOR UPDATE 
  USING (auth.uid() = id);

-- Allow service role to manage all profiles (for admin operations)
-- This uses the service_role key which bypasses RLS anyway, but it's good to be explicit
CREATE POLICY "service_role_all_access" 
  ON public.user_profiles 
  FOR ALL 
  USING (auth.jwt()->>'role' = 'service_role');

-- Grant necessary permissions to authenticated users
GRANT SELECT, INSERT, UPDATE ON public.user_profiles TO authenticated;
GRANT USAGE ON SEQUENCE IF EXISTS public.user_profiles_id_seq TO authenticated;

-- Ensure the table has proper constraints
ALTER TABLE public.user_profiles 
  ALTER COLUMN id SET NOT NULL,
  ALTER COLUMN email SET NOT NULL,
  ALTER COLUMN created_at SET DEFAULT NOW(),
  ALTER COLUMN updated_at SET DEFAULT NOW();

-- Add a trigger to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON public.user_profiles;

-- Create trigger for updated_at
CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create an index on email for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON public.user_profiles(email);

-- Add comment to table for documentation
COMMENT ON TABLE public.user_profiles IS 'User profiles table with relaxed RLS policies to allow auth callback profile creation';

-- Verify the policies are working by testing with a sample auth.uid()
-- This is just a comment showing how to test:
-- SET LOCAL "request.jwt.claims" TO '{"sub": "test-user-id"}';
-- INSERT INTO public.user_profiles (id, email, full_name) VALUES ('test-user-id', 'test@example.com', 'Test User');