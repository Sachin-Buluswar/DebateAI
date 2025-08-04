-- Update admin permissions to only grant super_admin to sachinbuluswar@gmail.com
-- First, remove existing admin roles
DELETE FROM public.user_roles 
WHERE role IN ('admin', 'super_admin');

-- Grant super_admin role to sachinbuluswar@gmail.com only
INSERT INTO public.user_roles (user_id, role, granted_by)
SELECT 
  u.id, 
  'super_admin'::user_role,
  u.id -- self-granted
FROM auth.users u
WHERE u.email = 'sachinbuluswar@gmail.com'
ON CONFLICT (user_id) DO UPDATE
SET role = 'super_admin'::user_role,
    updated_at = NOW();

-- Update any hardcoded admin checks in the codebase
-- Note: This migration only updates the database. 
-- You'll need to update any hardcoded email checks in the code.