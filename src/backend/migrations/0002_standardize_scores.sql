-- Migration: Standardize all scores in speech_feedback table
-- This migration updates the overall_score column for all existing records
-- and adds standardizedScore to the feedback JSON for consistency

-- Step 1: Update overall_score column for all existing records
UPDATE public.speech_feedback
SET overall_score = 
  CASE 
    -- NSDA format (25-30) to percentage
    WHEN feedback->>'speakerScore' IS NOT NULL 
      THEN ROUND(((CAST(feedback->>'speakerScore' AS FLOAT) - 25) / 5) * 100)
    
    -- JSON object format with 'overall' field
    WHEN feedback->>'score' LIKE '{%' AND 
         feedback->>'score' IS NOT NULL
      THEN 
        CASE 
          WHEN json_extract_path_text((feedback->>'score')::json, 'overall') IS NOT NULL
            THEN CAST(json_extract_path_text((feedback->>'score')::json, 'overall') AS INTEGER)
          -- Try 'content' field as fallback
          WHEN json_extract_path_text((feedback->>'score')::json, 'content') IS NOT NULL
            THEN CAST(json_extract_path_text((feedback->>'score')::json, 'content') AS INTEGER)
          ELSE NULL
        END
    
    -- Simple numeric score (already in percentage)
    WHEN feedback->>'score' IS NOT NULL AND feedback->>'score' NOT LIKE '{%'
      THEN CAST(feedback->>'score' AS INTEGER)
    
    -- Check if standardizedScore already exists (shouldn't happen but good to check)
    WHEN feedback->>'standardizedScore' IS NOT NULL
      THEN CAST(feedback->>'standardizedScore' AS INTEGER)
    
    ELSE NULL
  END
WHERE overall_score IS NULL;

-- Step 2: Add standardizedScore to feedback JSON for consistency
UPDATE public.speech_feedback
SET feedback = 
  CASE
    -- If overall_score was just set, add it to the JSON
    WHEN overall_score IS NOT NULL AND feedback->>'standardizedScore' IS NULL
      THEN jsonb_set(
        feedback,
        '{standardizedScore}',
        to_jsonb(overall_score)
      )
    -- Otherwise keep the feedback as is
    ELSE feedback
  END
WHERE overall_score IS NOT NULL 
  AND feedback->>'standardizedScore' IS NULL;

-- Step 3: Create index for better query performance on overall_score
CREATE INDEX IF NOT EXISTS idx_speech_feedback_overall_score 
ON public.speech_feedback(overall_score) 
WHERE overall_score IS NOT NULL;

-- Step 4: Create index for user_id and overall_score combined (for dashboard queries)
CREATE INDEX IF NOT EXISTS idx_speech_feedback_user_score 
ON public.speech_feedback(user_id, overall_score) 
WHERE overall_score IS NOT NULL;

-- Step 5: Create index for created_at to improve time-based queries
CREATE INDEX IF NOT EXISTS idx_speech_feedback_created_at 
ON public.speech_feedback(created_at DESC);

-- Step 6: Analyze the table to update statistics for query planner
ANALYZE public.speech_feedback;

-- Step 7: Report migration results
DO $$
DECLARE
  total_records INTEGER;
  updated_records INTEGER;
  null_records INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_records FROM public.speech_feedback;
  SELECT COUNT(*) INTO updated_records FROM public.speech_feedback WHERE overall_score IS NOT NULL;
  SELECT COUNT(*) INTO null_records FROM public.speech_feedback WHERE overall_score IS NULL;
  
  RAISE NOTICE 'Migration Results:';
  RAISE NOTICE '  Total records: %', total_records;
  RAISE NOTICE '  Records with overall_score: %', updated_records;
  RAISE NOTICE '  Records still NULL: %', null_records;
  RAISE NOTICE '  Success rate: %%%', ROUND((updated_records::NUMERIC / NULLIF(total_records, 0)) * 100, 2);
END $$;