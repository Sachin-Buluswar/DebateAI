-- Add missing columns to speech_feedback table for Public Forum debate support
-- This migration adds speech_type, user_side, file_size_bytes, and duration_seconds columns

-- Add speech_type column
ALTER TABLE speech_feedback 
ADD COLUMN IF NOT EXISTS speech_type TEXT DEFAULT 'debate';

-- Add user_side column  
ALTER TABLE speech_feedback 
ADD COLUMN IF NOT EXISTS user_side TEXT DEFAULT 'None';

-- Add file_size_bytes column
ALTER TABLE speech_feedback 
ADD COLUMN IF NOT EXISTS file_size_bytes INTEGER DEFAULT 0;

-- Add duration_seconds column
ALTER TABLE speech_feedback 
ADD COLUMN IF NOT EXISTS duration_seconds INTEGER DEFAULT 0;

-- Create index for speech_type for faster queries
CREATE INDEX IF NOT EXISTS idx_speech_feedback_speech_type ON speech_feedback(speech_type);

-- Create index for user_side for faster queries
CREATE INDEX IF NOT EXISTS idx_speech_feedback_user_side ON speech_feedback(user_side);

-- Update existing records to have proper defaults
UPDATE speech_feedback 
SET speech_type = 'debate' 
WHERE speech_type IS NULL;

UPDATE speech_feedback 
SET user_side = 'None' 
WHERE user_side IS NULL;

-- Add NOT NULL constraints now that we have defaults
ALTER TABLE speech_feedback 
ALTER COLUMN speech_type SET NOT NULL;

ALTER TABLE speech_feedback 
ALTER COLUMN user_side SET NOT NULL;