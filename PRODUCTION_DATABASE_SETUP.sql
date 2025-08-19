-- =====================================================
-- PRODUCTION DATABASE SETUP - RUN THIS BEFORE DEPLOYMENT
-- =====================================================
-- This script combines all critical database fixes for production
-- Run this in Supabase SQL Editor before deploying
-- Estimated run time: 2-3 minutes

-- =====================================================
-- STEP 1: CREATE USER ROLES TABLE AND FUNCTIONS
-- =====================================================

-- Create role enum if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        CREATE TYPE user_role AS ENUM ('user', 'moderator', 'admin', 'super_admin');
    END IF;
END $$;

-- Create user_roles table
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

-- Enable RLS
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Admin check function
CREATE OR REPLACE FUNCTION public.is_admin(check_user_id UUID DEFAULT NULL)
RETURNS BOOLEAN AS $$
BEGIN
    IF check_user_id IS NULL THEN
        check_user_id := auth.uid();
    END IF;
    
    RETURN EXISTS (
        SELECT 1 
        FROM public.user_roles
        WHERE user_id = check_user_id
        AND role IN ('admin', 'super_admin')
        AND (expires_at IS NULL OR expires_at > NOW())
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Role check function
CREATE OR REPLACE FUNCTION public.has_role(required_role user_role, check_user_id UUID DEFAULT NULL)
RETURNS BOOLEAN AS $$
BEGIN
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
-- STEP 2: CREATE RLS POLICIES FOR USER_ROLES
-- =====================================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own role" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Super admins can manage roles" ON public.user_roles;

-- Create policies
CREATE POLICY "Users can view their own role"
    ON public.user_roles FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles"
    ON public.user_roles FOR SELECT
    TO authenticated
    USING (public.is_admin());

CREATE POLICY "Super admins can manage roles"
    ON public.user_roles FOR ALL
    TO authenticated
    USING (public.has_role('super_admin'::user_role))
    WITH CHECK (public.has_role('super_admin'::user_role));

-- =====================================================
-- STEP 3: GRANT PERMISSIONS ON USER_ROLES
-- =====================================================

GRANT SELECT ON public.user_roles TO authenticated;
GRANT SELECT ON public.user_roles TO anon;
GRANT EXECUTE ON FUNCTION public.is_admin(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin(UUID) TO anon;
GRANT EXECUTE ON FUNCTION public.has_role(user_role, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(user_role, UUID) TO anon;

-- =====================================================
-- STEP 4: CREATE YOUR ADMIN USER
-- =====================================================
-- IMPORTANT: Replace 'YOUR_ADMIN_EMAIL@example.com' with your actual email

DO $$
DECLARE
    admin_user_id UUID;
BEGIN
    -- Get user ID for admin email
    SELECT id INTO admin_user_id
    FROM auth.users
    WHERE email = 'YOUR_ADMIN_EMAIL@example.com'; -- <-- CHANGE THIS!
    
    IF admin_user_id IS NOT NULL THEN
        -- Insert or update admin role
        INSERT INTO public.user_roles (user_id, role, granted_at)
        VALUES (admin_user_id, 'super_admin', NOW())
        ON CONFLICT (user_id) 
        DO UPDATE SET 
            role = 'super_admin',
            updated_at = NOW();
            
        RAISE NOTICE '✅ Admin role granted to user %', admin_user_id;
    ELSE
        RAISE WARNING '⚠️ User not found with that email. Update line 112 with your email!';
    END IF;
END $$;

-- =====================================================
-- STEP 5: CREATE PERFORMANCE INDEXES
-- =====================================================

-- User-related indexes
CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON public.user_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_created_at ON public.user_profiles(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id ON public.user_preferences(user_id);

-- Debate session indexes
CREATE INDEX IF NOT EXISTS idx_debate_sessions_user_id ON public.debate_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_debate_sessions_status ON public.debate_sessions(status);
CREATE INDEX IF NOT EXISTS idx_debate_sessions_created_at ON public.debate_sessions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_debate_sessions_user_status ON public.debate_sessions(user_id, status);

-- Speech feedback indexes
CREATE INDEX IF NOT EXISTS idx_speech_feedback_user_id ON public.speech_feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_speech_feedback_created_at ON public.speech_feedback(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_speech_feedback_speech_type ON public.speech_feedback(speech_type);
CREATE INDEX IF NOT EXISTS idx_speech_feedback_user_created ON public.speech_feedback(user_id, created_at DESC);

-- Document indexes
CREATE INDEX IF NOT EXISTS idx_documents_user_id ON public.documents(user_id);
CREATE INDEX IF NOT EXISTS idx_documents_status ON public.documents(status);
CREATE INDEX IF NOT EXISTS idx_documents_created_at ON public.documents(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_document_chunks_document_id ON public.document_chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_document_chunks_page_number ON public.document_chunks(page_number);

-- Debate and speech indexes
CREATE INDEX IF NOT EXISTS idx_debates_user_id ON public.debates(user_id);
CREATE INDEX IF NOT EXISTS idx_debates_status ON public.debates(status);
CREATE INDEX IF NOT EXISTS idx_speeches_session_id ON public.speeches(session_id);
CREATE INDEX IF NOT EXISTS idx_speeches_speaker_id ON public.speeches(speaker_id);

-- Search performance
CREATE INDEX IF NOT EXISTS idx_documents_search_vector ON public.documents USING gin(search_vector);
CREATE INDEX IF NOT EXISTS idx_document_chunks_search_vector ON public.document_chunks USING gin(to_tsvector('english', content));

-- =====================================================
-- STEP 6: CREATE UPDATE TRIGGERS
-- =====================================================

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.update_updated_at_column() TO authenticated;

-- Create triggers for all tables with updated_at
DO $$
DECLARE
    tbl RECORD;
    trigger_name TEXT;
BEGIN
    FOR tbl IN 
        SELECT table_name 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND column_name = 'updated_at'
        AND table_name NOT LIKE 'pg_%'
    LOOP
        trigger_name := 'update_' || tbl.table_name || '_updated_at';
        
        -- Drop existing trigger if it exists
        EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', trigger_name, tbl.table_name);
        
        -- Create new trigger
        EXECUTE format('
            CREATE TRIGGER %I
            BEFORE UPDATE ON public.%I
            FOR EACH ROW
            EXECUTE FUNCTION public.update_updated_at_column()',
            trigger_name, tbl.table_name
        );
        
        RAISE NOTICE 'Created trigger for %.%', 'public', tbl.table_name;
    END LOOP;
END $$;

-- =====================================================
-- STEP 7: VERIFY SETUP
-- =====================================================

-- Check indexes
SELECT 
    '📊 Indexes Created' as category,
    COUNT(*) as count
FROM pg_indexes 
WHERE schemaname = 'public'
AND indexname LIKE 'idx_%';

-- Check triggers
SELECT 
    '⚡ Triggers Created' as category,
    COUNT(DISTINCT trigger_name) as count
FROM information_schema.triggers
WHERE trigger_schema = 'public';

-- Check admin role
SELECT 
    '👤 Admin Users' as category,
    COUNT(*) as count
FROM public.user_roles
WHERE role IN ('admin', 'super_admin');

-- Check functions
SELECT 
    '🔧 Security Functions' as category,
    COUNT(*) as count
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' 
AND p.proname IN ('is_admin', 'has_role', 'update_updated_at_column');

-- Final success message
SELECT 
    '✅ PRODUCTION DATABASE SETUP COMPLETE' as status,
    'Remember to update line 112 with your admin email!' as action,
    NOW() as completed_at;

-- =====================================================
-- END OF SCRIPT
-- =====================================================
-- After running this script:
-- 1. Verify you see all success messages
-- 2. Check that your admin user was created
-- 3. Test login with your admin account
-- 4. Deploy your application!