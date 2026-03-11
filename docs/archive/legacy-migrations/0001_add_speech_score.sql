-- Add overall_score column to speech_feedback table
ALTER TABLE public.speech_feedback
ADD COLUMN overall_score INTEGER;

-- Optional: Add a check constraint if score should be within a range, e.g., 0-100
ALTER TABLE public.speech_feedback
ADD CONSTRAINT speech_feedback_overall_score_check CHECK (overall_score >= 0 AND overall_score <= 100); 