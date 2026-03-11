-- Enable Row Level Security on all public tables
ALTER TABLE public.health_check ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.debate_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.debate_speeches ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "health_check_public_read" ON public.health_check;
DROP POLICY IF EXISTS "debate_sessions_user_access" ON public.debate_sessions;
DROP POLICY IF EXISTS "debate_speeches_user_access" ON public.debate_speeches;

-- Health check table - allow public read access
CREATE POLICY "health_check_public_read" ON public.health_check
    FOR SELECT
    USING (true);

-- Debate sessions - users can only access their own sessions
CREATE POLICY "debate_sessions_user_access" ON public.debate_sessions
    FOR ALL
    USING (
        auth.uid() IS NOT NULL AND (
            user_id = auth.uid() OR 
            user_id IS NULL -- Allow access to sessions created before auth was implemented
        )
    );

-- Debate speeches - users can access speeches from their sessions
CREATE POLICY "debate_speeches_user_access" ON public.debate_speeches
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.debate_sessions
            WHERE debate_sessions.id = debate_speeches.session_id
            AND (debate_sessions.user_id = auth.uid() OR debate_sessions.user_id IS NULL)
        )
    );

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_debate_sessions_user_id ON public.debate_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_debate_speeches_session_id ON public.debate_speeches(session_id); 