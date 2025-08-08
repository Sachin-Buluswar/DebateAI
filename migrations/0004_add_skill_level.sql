-- Migration: Add skill level support for speech feedback
-- This migration adds a skill_level column to track user experience level

-- Step 1: Add skill_level column to speech_feedback table
ALTER TABLE public.speech_feedback
ADD COLUMN skill_level VARCHAR(20) DEFAULT 'intermediate';

-- Step 2: Add check constraint for valid skill levels
ALTER TABLE public.speech_feedback
ADD CONSTRAINT check_skill_level 
CHECK (skill_level IN ('novice', 'intermediate', 'advanced'));

-- Step 3: Create index for performance on skill level queries
CREATE INDEX IF NOT EXISTS idx_speech_feedback_skill_level 
ON public.speech_feedback(skill_level);

-- Step 4: Create index for combined user and skill level queries
CREATE INDEX IF NOT EXISTS idx_speech_feedback_user_skill 
ON public.speech_feedback(user_id, skill_level);

-- Step 5: Update existing records based on score patterns (optional intelligent migration)
-- This provides a reasonable default based on historical scoring
UPDATE public.speech_feedback
SET skill_level = CASE
  -- Scores below 70% suggest novice level
  WHEN overall_score < 70 THEN 'novice'
  -- Scores above 85% suggest advanced level
  WHEN overall_score >= 85 THEN 'advanced'
  -- Everything else is intermediate
  ELSE 'intermediate'
END
WHERE skill_level IS NULL OR skill_level = 'intermediate';

-- Step 6: Analyze table for query optimization
ANALYZE public.speech_feedback;

-- Step 7: Report migration results
DO $$
DECLARE
  total_count INTEGER;
  novice_count INTEGER;
  intermediate_count INTEGER;
  advanced_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_count FROM public.speech_feedback;
  SELECT COUNT(*) INTO novice_count FROM public.speech_feedback WHERE skill_level = 'novice';
  SELECT COUNT(*) INTO intermediate_count FROM public.speech_feedback WHERE skill_level = 'intermediate';
  SELECT COUNT(*) INTO advanced_count FROM public.speech_feedback WHERE skill_level = 'advanced';
  
  RAISE NOTICE 'Skill Level Migration Results:';
  RAISE NOTICE '  Total records: %', total_count;
  RAISE NOTICE '  Novice: %', novice_count;
  RAISE NOTICE '  Intermediate: %', intermediate_count;
  RAISE NOTICE '  Advanced: %', advanced_count;
  RAISE NOTICE 'Migration completed successfully!';
END $$;