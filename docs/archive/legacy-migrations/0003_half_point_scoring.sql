-- Migration: Enable half-point scoring for NSDA speaker points
-- This migration updates the overall_score column to support decimal values (half-points)
-- NSDA Public Forum debate allows scores like 26.5, 27.0, 27.5, etc.

-- Step 1: Alter the overall_score column from INTEGER to DECIMAL(4,1)
-- DECIMAL(4,1) allows values from 0.0 to 999.9 with one decimal place
ALTER TABLE public.speech_feedback
ALTER COLUMN overall_score TYPE DECIMAL(4,1)
USING overall_score::DECIMAL(4,1);

-- Step 2: Update the check constraint to ensure scores are still within 0-100 range
ALTER TABLE public.speech_feedback
DROP CONSTRAINT IF EXISTS speech_feedback_overall_score_check;

ALTER TABLE public.speech_feedback
ADD CONSTRAINT speech_feedback_overall_score_check 
CHECK (overall_score >= 0 AND overall_score <= 100);

-- Step 3: Round existing scores to nearest 0.5 for consistency with half-point scoring
-- This converts scores to the nearest half-point (e.g., 73 -> 73.0, 74 -> 74.0, 73.3 -> 73.5)
UPDATE public.speech_feedback
SET overall_score = ROUND(overall_score * 2) / 2
WHERE overall_score IS NOT NULL;

-- Step 4: Update the feedback JSON to include half-point scores in standardizedScore
UPDATE public.speech_feedback
SET feedback = jsonb_set(
  feedback,
  '{standardizedScore}',
  to_jsonb(overall_score)
)
WHERE overall_score IS NOT NULL 
  AND feedback IS NOT NULL;

-- Step 5: Also update the debate_feedback rating column if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'debate_feedback' 
    AND column_name = 'rating'
  ) THEN
    -- Change rating column to support decimals
    ALTER TABLE public.debate_feedback
    ALTER COLUMN rating TYPE DECIMAL(4,1)
    USING rating::DECIMAL(4,1);
    
    -- Round existing ratings to nearest 0.5
    UPDATE public.debate_feedback
    SET rating = ROUND(rating * 2) / 2
    WHERE rating IS NOT NULL;
  END IF;
END $$;

-- Step 6: Re-analyze tables for query optimization
ANALYZE public.speech_feedback;
ANALYZE public.debate_feedback;

-- Step 7: Report migration results
DO $$
DECLARE
  speech_count INTEGER;
  speech_updated INTEGER;
  debate_count INTEGER;
  debate_updated INTEGER;
BEGIN
  SELECT COUNT(*) INTO speech_count FROM public.speech_feedback;
  SELECT COUNT(*) INTO speech_updated FROM public.speech_feedback WHERE overall_score IS NOT NULL;
  
  SELECT COUNT(*) INTO debate_count FROM public.debate_feedback;
  SELECT COUNT(*) INTO debate_updated FROM public.debate_feedback WHERE rating IS NOT NULL;
  
  RAISE NOTICE 'Half-Point Scoring Migration Results:';
  RAISE NOTICE '  Speech Feedback:';
  RAISE NOTICE '    Total records: %', speech_count;
  RAISE NOTICE '    Records with scores: %', speech_updated;
  RAISE NOTICE '  Debate Feedback:';
  RAISE NOTICE '    Total records: %', debate_count;
  RAISE NOTICE '    Records with ratings: %', debate_updated;
  RAISE NOTICE '  Migration completed successfully!';
  RAISE NOTICE '  All scores now support half-point increments (X.0 and X.5)';
END $$;