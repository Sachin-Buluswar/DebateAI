-- Enable RLS and define policies for tables flagged by Supabase security advisors

-- 1. health_check -----------------------------------------------------------
ALTER TABLE IF EXISTS public.health_check ENABLE ROW LEVEL SECURITY;

-- Allow read-only access for all roles (including anon) but restrict write
DROP POLICY IF EXISTS health_check_read ON public.health_check;
CREATE POLICY health_check_read
  ON public.health_check
  FOR SELECT
  USING (true);

-- 2. debate_sessions --------------------------------------------------------
ALTER TABLE IF EXISTS public.debate_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS debate_sessions_user_access ON public.debate_sessions;
CREATE POLICY debate_sessions_user_access
  ON public.debate_sessions
  FOR ALL
  USING (auth.uid() = user_id OR user_id IS NULL);

-- 3. debate_speeches --------------------------------------------------------
ALTER TABLE IF EXISTS public.debate_speeches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS debate_speeches_user_access ON public.debate_speeches;
CREATE POLICY debate_speeches_user_access
  ON public.debate_speeches
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.debate_sessions
      WHERE debate_sessions.id = debate_speeches.session_id
        AND (debate_sessions.user_id = auth.uid() OR debate_sessions.user_id IS NULL)
    )
  );

-- 4. audio_recordings -------------------------------------------------------
ALTER TABLE IF EXISTS public.audio_recordings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS audio_recordings_user_access ON public.audio_recordings;
CREATE POLICY audio_recordings_user_access
  ON public.audio_recordings
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.debate_sessions
      WHERE debate_sessions.id = audio_recordings.session_id
        AND (debate_sessions.user_id = auth.uid() OR debate_sessions.user_id IS NULL)
    )
  );

-- Indexes to support policy look-ups ---------------------------------------
CREATE INDEX IF NOT EXISTS idx_debate_speeches_session_id ON public.debate_speeches(session_id);
CREATE INDEX IF NOT EXISTS idx_audio_recordings_session_id ON public.audio_recordings(session_id); 