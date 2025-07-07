-- Migration to fix saved_searches table structure
-- This script should be run using the Supabase SQL editor or via the /api/sql endpoint

-- Check if table exists first
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'saved_searches') THEN
    -- Table exists, let's check if it has the correct structure
    
    -- 1. Check if the 'results' column exists (it shouldn't according to schema)
    IF EXISTS (SELECT FROM information_schema.columns 
              WHERE table_name = 'saved_searches' AND column_name = 'results') THEN
      -- Drop the column - it's not in our official schema
      ALTER TABLE saved_searches DROP COLUMN results;
    END IF;
    
    -- 2. Ensure correct references
    -- We can't easily modify foreign key constraints in a DO block,
    -- so we'll do this outside
  ELSE
    -- Table doesn't exist, create it with correct structure
    EXECUTE '
      CREATE TABLE IF NOT EXISTS saved_searches (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        query TEXT NOT NULL,
        results_count INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE(''utc''::text, NOW()) NOT NULL
      );
      
      ALTER TABLE saved_searches ENABLE ROW LEVEL SECURITY;
      
      CREATE POLICY "Users can view own saved searches" 
        ON saved_searches 
        FOR SELECT 
        USING (auth.uid() = user_id);
      
      CREATE POLICY "Users can insert own saved searches" 
        ON saved_searches 
        FOR INSERT 
        WITH CHECK (auth.uid() = user_id);
      
      CREATE INDEX IF NOT EXISTS saved_searches_user_id_idx ON saved_searches(user_id);
    ';
  END IF;
END
$$;

-- Handle foreign key constraint modifications outside the DO block
-- This is more reliable for changing constraints
BEGIN;

-- First, check if the user_id column references auth.users instead of users
-- We can't directly query constraints easily, so let's recreate the constraint if needed
ALTER TABLE saved_searches DROP CONSTRAINT IF EXISTS saved_searches_user_id_fkey;
ALTER TABLE saved_searches ADD CONSTRAINT saved_searches_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

COMMIT; 