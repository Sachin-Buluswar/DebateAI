-- Create debates table for real-time debate sessions
CREATE TABLE IF NOT EXISTS debates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic TEXT NOT NULL,
  participants JSONB NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'completed', 'cancelled')),
  phase TEXT,
  current_speaker_id TEXT,
  debate_config JSONB DEFAULT '{}',
  transcript JSONB DEFAULT '[]',
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX idx_debates_status ON debates(status);
CREATE INDEX idx_debates_created_at ON debates(created_at DESC);

-- Enable RLS
ALTER TABLE debates ENABLE ROW LEVEL SECURITY;

-- Create policies for debates table
-- Anyone can view debates (for now - can be restricted later)
CREATE POLICY "Debates are viewable by everyone" ON debates
  FOR SELECT USING (true);

-- Only authenticated users can create debates
CREATE POLICY "Authenticated users can create debates" ON debates
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Only debate participants can update debates
CREATE POLICY "Participants can update their debates" ON debates
  FOR UPDATE USING (
    auth.uid() IS NOT NULL AND 
    (participants @> jsonb_build_array(jsonb_build_object('userId', auth.uid()::text)))
  );

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_debates_updated_at BEFORE UPDATE ON debates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create debate_messages table for storing crossfire messages
CREATE TABLE IF NOT EXISTS debate_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  debate_id UUID NOT NULL REFERENCES debates(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  speaker_id TEXT NOT NULL,
  message TEXT NOT NULL,
  message_type TEXT DEFAULT 'speech' CHECK (message_type IN ('speech', 'crossfire', 'system')),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster message queries
CREATE INDEX idx_debate_messages_debate_id ON debate_messages(debate_id);
CREATE INDEX idx_debate_messages_created_at ON debate_messages(created_at);

-- Enable RLS on messages
ALTER TABLE debate_messages ENABLE ROW LEVEL SECURITY;

-- Message policies
CREATE POLICY "Messages are viewable by debate participants" ON debate_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM debates 
      WHERE debates.id = debate_messages.debate_id 
      AND (
        debates.participants @> jsonb_build_array(jsonb_build_object('userId', auth.uid()::text))
        OR debates.status = 'completed' -- Completed debates are public
      )
    )
  );

CREATE POLICY "Participants can insert messages" ON debate_messages
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM debates 
      WHERE debates.id = debate_messages.debate_id 
      AND debates.status = 'active'
      AND debates.participants @> jsonb_build_array(jsonb_build_object('userId', auth.uid()::text))
    )
  );

-- Grant necessary permissions
GRANT ALL ON debates TO authenticated;
GRANT ALL ON debate_messages TO authenticated;

-- Create Realtime publication for debates
ALTER PUBLICATION supabase_realtime ADD TABLE debates;
ALTER PUBLICATION supabase_realtime ADD TABLE debate_messages;