-- Create audio storage buckets with appropriate settings for Eris Debate
-- This script ensures that speech_audio and debate_audio buckets exist
-- with appropriate permissions and file size limits

-- First check if the buckets already exist
DO $$
DECLARE
  speech_bucket_exists BOOLEAN;
  debate_bucket_exists BOOLEAN;
BEGIN
  -- Check if speech_audio exists
  SELECT EXISTS (
    SELECT 1 FROM storage.buckets WHERE name = 'speech_audio'
  ) INTO speech_bucket_exists;
  
  -- Check if debate_audio exists
  SELECT EXISTS (
    SELECT 1 FROM storage.buckets WHERE name = 'debate_audio'
  ) INTO debate_bucket_exists;
  
  -- Create speech_audio bucket if it doesn't exist
  IF NOT speech_bucket_exists THEN
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES 
      ('speech_audio', 'speech_audio', TRUE, 62914560, ARRAY['audio/mpeg', 'audio/wav', 'audio/mp3', 'audio/ogg']);
    
    -- Enable RLS on the bucket
    INSERT INTO storage.policies (name, bucket_id, definition, allow, verified_user)
    VALUES
      ('User can upload and read own files', 'speech_audio', 
        '(auth.uid() = owner) AND (storage.foldername(name)[1] = auth.uid()::text)',
        TRUE, NULL);
  ELSE
    -- Update existing speech_audio bucket
    UPDATE storage.buckets 
    SET 
      public = TRUE,
      file_size_limit = 62914560,
      allowed_mime_types = ARRAY['audio/mpeg', 'audio/wav', 'audio/mp3', 'audio/ogg']
    WHERE name = 'speech_audio';
  END IF;
  
  -- Create debate_audio bucket if it doesn't exist
  IF NOT debate_bucket_exists THEN
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES 
      ('debate_audio', 'debate_audio', TRUE, 62914560, ARRAY['audio/mpeg', 'audio/wav', 'audio/mp3', 'audio/ogg']);
    
    -- Enable RLS on the bucket
    INSERT INTO storage.policies (name, bucket_id, definition, allow, verified_user)
    VALUES
      ('User can upload and read own files', 'debate_audio', 
        '(auth.uid() = owner) AND (storage.foldername(name)[1] = auth.uid()::text)',
        TRUE, NULL);
  ELSE
    -- Update existing debate_audio bucket
    UPDATE storage.buckets 
    SET 
      public = TRUE,
      file_size_limit = 62914560,
      allowed_mime_types = ARRAY['audio/mpeg', 'audio/wav', 'audio/mp3', 'audio/ogg']
    WHERE name = 'debate_audio';
  END IF;
END $$;

-- Set up policies for the speech_audio bucket
DROP POLICY IF EXISTS "Users can view their own speech audio" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload their own speech audio" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own speech audio" ON storage.objects;

CREATE POLICY "Users can view their own speech audio"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'speech_audio' AND auth.uid() = owner);

CREATE POLICY "Users can upload their own speech audio"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'speech_audio' AND auth.uid() = owner);

CREATE POLICY "Users can update their own speech audio"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'speech_audio' AND auth.uid() = owner);

-- Set up policies for the debate_audio bucket
DROP POLICY IF EXISTS "Users can view their own debate audio" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload their own debate audio" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own debate audio" ON storage.objects;

CREATE POLICY "Users can view their own debate audio"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'debate_audio' AND auth.uid() = owner);

CREATE POLICY "Users can upload their own debate audio"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'debate_audio' AND auth.uid() = owner);

CREATE POLICY "Users can update their own debate audio"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'debate_audio' AND auth.uid() = owner);

-- Modify the debate_history table to add an audio_url field
ALTER TABLE debate_history
ADD COLUMN audio_url TEXT;

-- Create speech_feedback table if it doesn't exist
CREATE TABLE IF NOT EXISTS speech_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  topic TEXT NOT NULL,
  feedback JSONB,
  audio_url TEXT,
  transcription TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Set up RLS for speech_feedback table
ALTER TABLE speech_feedback ENABLE ROW LEVEL SECURITY;

-- Create policies for speech_feedback
CREATE POLICY "Users can view own speech feedback" 
  ON speech_feedback 
  FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own speech feedback" 
  ON speech_feedback 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_speech_feedback_user_id ON speech_feedback(user_id); 