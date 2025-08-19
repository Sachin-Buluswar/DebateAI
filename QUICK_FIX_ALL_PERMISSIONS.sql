-- QUICK FIX: Grant all necessary permissions in one go
-- Run this in Supabase SQL Editor to fix ALL permission issues immediately

-- Grant permissions to authenticated users for all tables
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;

-- Grant SELECT on all tables to anon for public viewing
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;

-- Grant USAGE on all sequences
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Quick verification
SELECT 
    tablename,
    COUNT(DISTINCT grantee) as grantee_count,
    COUNT(DISTINCT privilege_type) as privilege_count,
    CASE 
        WHEN COUNT(DISTINCT privilege_type) >= 3 THEN '✅ FIXED'
        ELSE '⚠️ CHECK'
    END as status
FROM pg_tables t
LEFT JOIN information_schema.table_privileges p
    ON t.tablename = p.table_name 
    AND p.table_schema = 'public'
    AND p.grantee IN ('authenticated', 'anon')
WHERE t.schemaname = 'public'
GROUP BY tablename
ORDER BY tablename;

SELECT 
    '✅ ALL PERMISSIONS GRANTED!' as status,
    'Test the application now - everything should work' as message;