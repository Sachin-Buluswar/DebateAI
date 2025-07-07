-- Create debate_history table if it doesn't exist
CREATE TABLE IF NOT EXISTS debate_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  title TEXT NOT NULL,
  type TEXT NOT NULL,
  description TEXT,
  transcript TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Set up Row Level Security (RLS) for the debate_history table
ALTER TABLE debate_history ENABLE ROW LEVEL SECURITY;

-- Create policy to allow users to view only their own debate history
CREATE POLICY "Users can view own debate history" 
  ON debate_history 
  FOR SELECT 
  USING (auth.uid() = user_id);

-- Create policy to allow users to insert their own debate history
CREATE POLICY "Users can insert own debate history" 
  ON debate_history 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

-- Create an index on user_id for faster queries
CREATE INDEX IF NOT EXISTS idx_debate_history_user_id ON debate_history(user_id); 