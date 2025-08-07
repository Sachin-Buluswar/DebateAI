-- Fix debate_sessions table RLS policies
-- This table already exists but may have insufficient policies

-- Enable RLS
ALTER TABLE debate_sessions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to start fresh
DROP POLICY IF EXISTS "Users can view own sessions" ON debate_sessions;
DROP POLICY IF EXISTS "Users can create sessions" ON debate_sessions;
DROP POLICY IF EXISTS "Users can update own sessions" ON debate_sessions;
DROP POLICY IF EXISTS "Users can delete own sessions" ON debate_sessions;

-- Users can view their own debate sessions
CREATE POLICY "Users can view own sessions" ON debate_sessions
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id OR user_id IS NULL);

-- Users can create debate sessions
CREATE POLICY "Users can create sessions" ON debate_sessions
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- Users can update their own sessions
CREATE POLICY "Users can update own sessions" ON debate_sessions
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id OR user_id IS NULL)
    WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- Users can delete their own sessions
CREATE POLICY "Users can delete own sessions" ON debate_sessions
    FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id OR user_id IS NULL);

-- Add foreign key constraint if missing
DO $$
BEGIN
    -- Check if foreign key exists
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE constraint_type = 'FOREIGN KEY' 
        AND table_name = 'debate_sessions' 
        AND constraint_name = 'debate_sessions_user_id_fkey'
    ) THEN
        -- Add foreign key constraint
        ALTER TABLE debate_sessions
        ADD CONSTRAINT debate_sessions_user_id_fkey
        FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Add check constraint for user_side if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE table_name = 'debate_sessions' 
        AND constraint_name = 'debate_sessions_user_side_check'
    ) THEN
        ALTER TABLE debate_sessions
        ADD CONSTRAINT debate_sessions_user_side_check
        CHECK (user_side IN ('PRO', 'CON'));
    END IF;
END $$;

-- Add check constraint for status if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE table_name = 'debate_sessions' 
        AND constraint_name = 'debate_sessions_status_check'
    ) THEN
        ALTER TABLE debate_sessions
        ADD CONSTRAINT debate_sessions_status_check
        CHECK (status IN ('setup', 'active', 'paused', 'completed', 'cancelled'));
    END IF;
END $$;