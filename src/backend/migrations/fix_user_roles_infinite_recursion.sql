-- CRITICAL: Fix infinite recursion in user_roles table policies
-- This issue is blocking authentication and user profile queries

-- Drop existing policies that cause infinite recursion
DROP POLICY IF EXISTS "Admins can view all roles" ON user_roles;
DROP POLICY IF EXISTS "Super admins can manage roles" ON user_roles;
DROP POLICY IF EXISTS "Users can view own role" ON user_roles;

-- Create new policies without recursion
-- Users can view their own roles (simple, no recursion)
CREATE POLICY "Users can view own role" ON user_roles
    FOR SELECT
    TO public
    USING (user_id = auth.uid());

-- For admin checks, we need a different approach
-- Create a function to check admin status without recursion
CREATE OR REPLACE FUNCTION is_admin_or_super_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'super_admin')
    AND (expires_at IS NULL OR expires_at > now())
  );
$$;

-- Create a function to check super admin status
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM user_roles 
    WHERE user_id = auth.uid() 
    AND role = 'super_admin'
    AND (expires_at IS NULL OR expires_at > now())
  );
$$;

-- Now create policies using the functions (avoids recursion)
CREATE POLICY "Admins can view all roles" ON user_roles
    FOR SELECT
    TO public
    USING (is_admin_or_super_admin());

CREATE POLICY "Super admins can manage roles" ON user_roles
    FOR ALL
    TO public
    USING (is_super_admin())
    WITH CHECK (is_super_admin());