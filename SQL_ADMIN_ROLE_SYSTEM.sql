-- =====================================================
-- ADMIN ROLE SYSTEM SETUP
-- =====================================================
-- This script sets up proper admin role checking and permissions
-- Run this to ensure only admins can access admin functions

-- =====================================================
-- 1. ENSURE USER_ROLES TABLE EXISTS
-- =====================================================

-- Check if user_roles table exists and has proper structure
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        CREATE TYPE user_role AS ENUM ('user', 'moderator', 'admin', 'super_admin');
    END IF;
END $$;

-- Ensure user_roles table exists with proper structure
CREATE TABLE IF NOT EXISTS public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role user_role NOT NULL DEFAULT 'user',
    granted_by UUID REFERENCES auth.users(id),
    granted_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 2. CREATE ADMIN CHECK FUNCTION
-- =====================================================

-- Function to check if a user is an admin
CREATE OR REPLACE FUNCTION public.is_admin(check_user_id UUID DEFAULT NULL)
RETURNS BOOLEAN AS $$
BEGIN
    -- If no user_id provided, check current auth user
    IF check_user_id IS NULL THEN
        check_user_id := auth.uid();
    END IF;
    
    -- Check if user has admin or super_admin role
    RETURN EXISTS (
        SELECT 1 
        FROM public.user_roles
        WHERE user_id = check_user_id
        AND role IN ('admin', 'super_admin')
        AND (expires_at IS NULL OR expires_at > NOW())
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check specific role
CREATE OR REPLACE FUNCTION public.has_role(required_role user_role, check_user_id UUID DEFAULT NULL)
RETURNS BOOLEAN AS $$
BEGIN
    -- If no user_id provided, check current auth user
    IF check_user_id IS NULL THEN
        check_user_id := auth.uid();
    END IF;
    
    RETURN EXISTS (
        SELECT 1 
        FROM public.user_roles
        WHERE user_id = check_user_id
        AND role = required_role
        AND (expires_at IS NULL OR expires_at > NOW())
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 3. CREATE RLS POLICIES FOR USER_ROLES
-- =====================================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own role" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Super admins can manage roles" ON public.user_roles;

-- Users can see their own role
CREATE POLICY "Users can view their own role"
    ON public.user_roles FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

-- Admins can see all roles
CREATE POLICY "Admins can view all roles"
    ON public.user_roles FOR SELECT
    TO authenticated
    USING (public.is_admin());

-- Only super_admins can manage roles
CREATE POLICY "Super admins can manage roles"
    ON public.user_roles FOR ALL
    TO authenticated
    USING (public.has_role('super_admin'::user_role))
    WITH CHECK (public.has_role('super_admin'::user_role));

-- =====================================================
-- 4. CREATE ADMIN-ONLY TABLE POLICIES
-- =====================================================

-- Example: Create admin-only policy for documents management
DROP POLICY IF EXISTS "Admins can manage documents" ON public.documents;
CREATE POLICY "Admins can manage documents"
    ON public.documents FOR ALL
    TO authenticated
    USING (
        -- Users can manage their own documents OR admins can manage all
        auth.uid() = user_id OR public.is_admin()
    )
    WITH CHECK (
        auth.uid() = user_id OR public.is_admin()
    );

-- =====================================================
-- 5. GRANT NECESSARY PERMISSIONS
-- =====================================================

-- Grant permissions on user_roles table
GRANT SELECT ON public.user_roles TO authenticated;
GRANT SELECT ON public.user_roles TO anon; -- For public role checking

-- Grant execute on admin check functions
GRANT EXECUTE ON FUNCTION public.is_admin(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin(UUID) TO anon;
GRANT EXECUTE ON FUNCTION public.has_role(user_role, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(user_role, UUID) TO anon;

-- =====================================================
-- 6. CREATE DEFAULT ADMIN (OPTIONAL)
-- =====================================================

-- IMPORTANT: Replace 'your-admin-email@example.com' with your actual admin email
-- Uncomment and modify the following to create an admin user:

/*
DO $$
DECLARE
    admin_user_id UUID;
BEGIN
    -- Get user ID for admin email
    SELECT id INTO admin_user_id
    FROM auth.users
    WHERE email = 'your-admin-email@example.com';
    
    IF admin_user_id IS NOT NULL THEN
        -- Insert or update admin role
        INSERT INTO public.user_roles (user_id, role, granted_at)
        VALUES (admin_user_id, 'super_admin', NOW())
        ON CONFLICT (user_id) 
        DO UPDATE SET 
            role = 'super_admin',
            updated_at = NOW();
            
        RAISE NOTICE 'Admin role granted to user %', admin_user_id;
    ELSE
        RAISE NOTICE 'User not found with that email';
    END IF;
END $$;
*/

-- =====================================================
-- 7. CREATE ADMIN ACTIVITY LOG TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS public.admin_activity_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id UUID NOT NULL REFERENCES auth.users(id),
    action TEXT NOT NULL,
    target_table TEXT,
    target_id UUID,
    details JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.admin_activity_log ENABLE ROW LEVEL SECURITY;

-- Only super_admins can view logs
CREATE POLICY "Super admins can view activity logs"
    ON public.admin_activity_log FOR SELECT
    TO authenticated
    USING (public.has_role('super_admin'::user_role));

-- Grant permissions
GRANT INSERT ON public.admin_activity_log TO authenticated;

-- Create index for performance
CREATE INDEX idx_admin_activity_log_admin_id ON public.admin_activity_log(admin_id);
CREATE INDEX idx_admin_activity_log_created_at ON public.admin_activity_log(created_at DESC);

-- =====================================================
-- 8. VERIFICATION QUERIES
-- =====================================================

-- Check current user roles
SELECT 
    u.email,
    r.role,
    r.granted_at,
    r.expires_at,
    CASE 
        WHEN r.role IN ('admin', 'super_admin') THEN '🔐 Admin Access'
        WHEN r.role = 'moderator' THEN '👮 Moderator'
        ELSE '👤 Regular User'
    END as access_level
FROM auth.users u
LEFT JOIN public.user_roles r ON u.id = r.user_id
ORDER BY 
    CASE r.role
        WHEN 'super_admin' THEN 1
        WHEN 'admin' THEN 2
        WHEN 'moderator' THEN 3
        ELSE 4
    END,
    u.email;

-- Test admin check functions (replace with actual user ID)
SELECT 
    'Admin Check Functions' as test,
    public.is_admin() as "Current user is admin?",
    public.has_role('admin'::user_role) as "Current user has admin role?",
    public.has_role('super_admin'::user_role) as "Current user has super_admin role?";

-- =====================================================
-- 9. SUCCESS MESSAGE
-- =====================================================

SELECT 
    '✅ ADMIN ROLE SYSTEM CONFIGURED' as status,
    'Remember to grant admin roles to specific users' as next_step,
    'Use the commented section above to grant admin access' as instruction;