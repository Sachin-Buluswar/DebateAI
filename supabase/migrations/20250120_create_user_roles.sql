-- Create user roles table and implement proper RBAC
-- This migration adds role-based access control to replace hardcoded admin checks

-- Create enum for user roles
CREATE TYPE user_role AS ENUM ('user', 'moderator', 'admin', 'super_admin');

-- Create user_roles table
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role user_role NOT NULL DEFAULT 'user',
  granted_by UUID REFERENCES auth.users(id),
  granted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Create indexes
CREATE INDEX idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX idx_user_roles_role ON public.user_roles(role);
CREATE INDEX idx_user_roles_expires_at ON public.user_roles(expires_at) WHERE expires_at IS NOT NULL;

-- Enable RLS
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_roles table
-- Only admins and super_admins can view all roles
CREATE POLICY "Admins can view all roles" ON public.user_roles
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
      AND ur.role IN ('admin', 'super_admin')
      AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
    )
  );

-- Users can view their own role
CREATE POLICY "Users can view own role" ON public.user_roles
  FOR SELECT
  USING (user_id = auth.uid());

-- Only super_admins can insert/update/delete roles
CREATE POLICY "Super admins can manage roles" ON public.user_roles
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
      AND ur.role = 'super_admin'
      AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
    )
  );

-- Create function to check user role
CREATE OR REPLACE FUNCTION public.check_user_role(required_role user_role)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_role_record RECORD;
BEGIN
  -- Get the user's role
  SELECT role, expires_at INTO user_role_record
  FROM public.user_roles
  WHERE user_id = auth.uid()
  AND (expires_at IS NULL OR expires_at > NOW());

  -- If no role found, user has default 'user' role
  IF NOT FOUND THEN
    RETURN required_role = 'user';
  END IF;

  -- Check role hierarchy
  CASE required_role
    WHEN 'user' THEN
      RETURN TRUE; -- Everyone has at least user role
    WHEN 'moderator' THEN
      RETURN user_role_record.role IN ('moderator', 'admin', 'super_admin');
    WHEN 'admin' THEN
      RETURN user_role_record.role IN ('admin', 'super_admin');
    WHEN 'super_admin' THEN
      RETURN user_role_record.role = 'super_admin';
    ELSE
      RETURN FALSE;
  END CASE;
END;
$$;

-- Create function to get user role
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS user_role
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_role_value user_role;
BEGIN
  SELECT role INTO user_role_value
  FROM public.user_roles
  WHERE user_id = auth.uid()
  AND (expires_at IS NULL OR expires_at > NOW());

  -- If no role found, return default 'user' role
  IF NOT FOUND THEN
    RETURN 'user'::user_role;
  END IF;

  RETURN user_role_value;
END;
$$;

-- Update RLS policies for documents table to use role-based access
-- Admins can manage all documents
CREATE POLICY "Admins can manage all documents" ON public.documents
  FOR ALL
  USING (public.check_user_role('admin'::user_role));

-- Update RLS policies for document_chunks table
CREATE POLICY "Admins can manage all chunks" ON public.document_chunks
  FOR ALL
  USING (public.check_user_role('admin'::user_role));

-- Update RLS policies for opencaselist_scrape_log table
CREATE POLICY "Admins can view scrape logs" ON public.opencaselist_scrape_log
  FOR SELECT
  USING (public.check_user_role('admin'::user_role));

-- Initialize roles for existing admin users
-- Note: Replace these emails with actual admin emails from your system
INSERT INTO public.user_roles (user_id, role, granted_by)
SELECT 
  u.id, 
  'super_admin'::user_role,
  u.id -- self-granted for initial setup
FROM auth.users u
WHERE u.email IN ('admin@erisdebate.com', 'claudecode@gmail.com')
ON CONFLICT (user_id) DO UPDATE
SET role = 'super_admin'::user_role,
    updated_at = NOW();

-- Create view for easier role checking in application
CREATE OR REPLACE VIEW public.user_roles_view AS
SELECT 
  u.id as user_id,
  u.email,
  COALESCE(ur.role, 'user'::user_role) as role,
  ur.granted_by,
  ur.granted_at,
  ur.expires_at,
  CASE 
    WHEN ur.expires_at IS NULL THEN TRUE
    WHEN ur.expires_at > NOW() THEN TRUE
    ELSE FALSE
  END as is_active
FROM auth.users u
LEFT JOIN public.user_roles ur ON u.id = ur.user_id;

-- Grant access to the view
GRANT SELECT ON public.user_roles_view TO authenticated;

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_user_roles_updated_at
  BEFORE UPDATE ON public.user_roles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add comment explaining the role system
COMMENT ON TABLE public.user_roles IS 'Stores user roles for RBAC. Roles are hierarchical: user < moderator < admin < super_admin';
COMMENT ON COLUMN public.user_roles.expires_at IS 'Optional expiration for temporary role assignments';
COMMENT ON FUNCTION public.check_user_role IS 'Checks if the current user has the required role or higher';
COMMENT ON FUNCTION public.get_user_role IS 'Returns the current user''s role, defaults to ''user'' if not found';