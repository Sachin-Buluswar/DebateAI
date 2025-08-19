-- =====================================================
-- FIX MISSING TRIGGERS AND FUNCTIONS
-- =====================================================
-- This script creates essential database triggers and functions
-- that should exist but might be missing

-- =====================================================
-- 1. UPDATED_AT TRIGGER FUNCTION
-- =====================================================

-- Create or replace the function that updates updated_at columns
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.update_updated_at_column() TO authenticated;

-- =====================================================
-- 2. CREATE TRIGGERS FOR ALL TABLES
-- =====================================================

-- Helper function to create triggers for all tables with updated_at
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
-- 3. SOFT DELETE SUPPORT (OPTIONAL)
-- =====================================================

-- Function for soft delete pattern
CREATE OR REPLACE FUNCTION public.soft_delete()
RETURNS TRIGGER AS $$
BEGIN
    -- Instead of deleting, set deleted_at timestamp
    NEW.deleted_at = NOW();
    NEW.is_deleted = TRUE;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 4. AUDIT LOG FUNCTION
-- =====================================================

-- Create audit log table if needed
CREATE TABLE IF NOT EXISTS public.audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_name TEXT NOT NULL,
    operation TEXT NOT NULL,
    user_id UUID,
    record_id UUID,
    old_data JSONB,
    new_data JSONB,
    changed_fields TEXT[],
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Only admins can view audit logs
CREATE POLICY "Admins can view audit logs"
    ON public.audit_log FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles
            WHERE user_id = auth.uid()
            AND role IN ('admin', 'super_admin')
        )
    );

-- Grant permissions
GRANT INSERT ON public.audit_log TO authenticated;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_audit_log_table_name ON public.audit_log(table_name);
CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON public.audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON public.audit_log(created_at DESC);

-- Audit trigger function
CREATE OR REPLACE FUNCTION public.audit_trigger()
RETURNS TRIGGER AS $$
DECLARE
    changed_fields TEXT[];
    old_jsonb JSONB;
    new_jsonb JSONB;
BEGIN
    -- Convert records to JSONB
    IF TG_OP = 'DELETE' THEN
        old_jsonb := to_jsonb(OLD);
        new_jsonb := NULL;
    ELSIF TG_OP = 'INSERT' THEN
        old_jsonb := NULL;
        new_jsonb := to_jsonb(NEW);
    ELSE -- UPDATE
        old_jsonb := to_jsonb(OLD);
        new_jsonb := to_jsonb(NEW);
        
        -- Find changed fields
        SELECT array_agg(key) INTO changed_fields
        FROM jsonb_each(old_jsonb) o
        FULL OUTER JOIN jsonb_each(new_jsonb) n USING (key)
        WHERE o.value IS DISTINCT FROM n.value;
    END IF;
    
    -- Insert audit record
    INSERT INTO public.audit_log (
        table_name,
        operation,
        user_id,
        record_id,
        old_data,
        new_data,
        changed_fields
    ) VALUES (
        TG_TABLE_NAME,
        TG_OP,
        auth.uid(),
        COALESCE(NEW.id, OLD.id),
        old_jsonb,
        new_jsonb,
        changed_fields
    );
    
    -- Return appropriate value
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 5. SEARCH VECTOR UPDATE FUNCTION
-- =====================================================

-- Function to update search vectors for full-text search
CREATE OR REPLACE FUNCTION public.update_search_vector()
RETURNS TRIGGER AS $$
BEGIN
    -- Update search_vector based on relevant text fields
    IF TG_TABLE_NAME = 'documents' THEN
        NEW.search_vector := to_tsvector('english', 
            COALESCE(NEW.title, '') || ' ' || 
            COALESCE(NEW.content, '')
        );
    ELSIF TG_TABLE_NAME = 'speech_feedback' THEN
        NEW.search_vector := to_tsvector('english',
            COALESCE(NEW.topic, '') || ' ' ||
            COALESCE(NEW.transcription, '')
        );
    ELSIF TG_TABLE_NAME = 'debates' THEN
        NEW.search_vector := to_tsvector('english',
            COALESCE(NEW.topic, '') || ' ' ||
            COALESCE(NEW.description, '')
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for tables with search_vector columns
DO $$
DECLARE
    tbl RECORD;
BEGIN
    FOR tbl IN 
        SELECT table_name 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND column_name = 'search_vector'
    LOOP
        -- Drop existing trigger
        EXECUTE format('DROP TRIGGER IF EXISTS update_%s_search_vector ON public.%I', 
                      tbl.table_name, tbl.table_name);
        
        -- Create new trigger
        EXECUTE format('
            CREATE TRIGGER update_%s_search_vector
            BEFORE INSERT OR UPDATE ON public.%I
            FOR EACH ROW
            EXECUTE FUNCTION public.update_search_vector()',
            tbl.table_name, tbl.table_name
        );
        
        RAISE NOTICE 'Created search vector trigger for %', tbl.table_name;
    END LOOP;
END $$;

-- =====================================================
-- 6. CASCADE DELETE CLEANUP
-- =====================================================

-- Function to handle cascade deletes properly
CREATE OR REPLACE FUNCTION public.cascade_delete_cleanup()
RETURNS TRIGGER AS $$
BEGIN
    -- Clean up related records when parent is deleted
    IF TG_TABLE_NAME = 'debate_sessions' THEN
        -- Delete related speeches
        DELETE FROM public.debate_speeches WHERE session_id = OLD.id;
        -- Delete related audio
        DELETE FROM public.audio_recordings WHERE session_id = OLD.id;
    ELSIF TG_TABLE_NAME = 'debates' THEN
        -- Delete related feedback
        DELETE FROM public.debate_feedback WHERE debate_id = OLD.id;
    END IF;
    
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 7. VERIFICATION
-- =====================================================

-- List all triggers
SELECT 
    t.trigger_name,
    t.event_object_table as table_name,
    t.event_manipulation as trigger_event,
    t.action_timing as trigger_timing,
    p.proname as function_name
FROM information_schema.triggers t
JOIN pg_trigger tg ON tg.tgname = t.trigger_name
JOIN pg_proc p ON p.oid = tg.tgfoid
WHERE t.trigger_schema = 'public'
ORDER BY t.event_object_table, t.trigger_name;

-- Check for tables missing updated_at triggers
SELECT 
    c.table_name,
    CASE 
        WHEN t.trigger_name IS NULL THEN '❌ Missing trigger'
        ELSE '✅ Has trigger'
    END as trigger_status
FROM information_schema.columns c
LEFT JOIN information_schema.triggers t 
    ON t.event_object_table = c.table_name 
    AND t.trigger_name LIKE '%updated_at%'
WHERE c.table_schema = 'public'
    AND c.column_name = 'updated_at'
    AND c.table_name NOT LIKE 'pg_%'
ORDER BY trigger_status, c.table_name;

-- =====================================================
-- 8. SUCCESS MESSAGE
-- =====================================================

SELECT 
    '✅ TRIGGERS AND FUNCTIONS CREATED' as status,
    COUNT(DISTINCT trigger_name) || ' triggers active' as trigger_count,
    'All tables with updated_at now have auto-update triggers' as message
FROM information_schema.triggers
WHERE trigger_schema = 'public';