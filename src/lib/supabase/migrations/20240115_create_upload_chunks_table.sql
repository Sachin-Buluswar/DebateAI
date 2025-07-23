-- Create temporary upload chunks table for handling large file uploads in serverless environments
CREATE TABLE IF NOT EXISTS upload_chunks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  chunk_data BYTEA NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(session_id, chunk_index)
);

-- Create index for faster lookups
CREATE INDEX idx_upload_chunks_session_id ON upload_chunks(session_id);
CREATE INDEX idx_upload_chunks_created_at ON upload_chunks(created_at);

-- Create upload sessions table
CREATE TABLE IF NOT EXISTS upload_sessions (
  session_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  filename TEXT NOT NULL,
  content_type TEXT NOT NULL,
  total_size INTEGER NOT NULL,
  total_chunks INTEGER NOT NULL,
  uploaded_chunks INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed BOOLEAN DEFAULT FALSE
);

-- Create index for cleanup
CREATE INDEX idx_upload_sessions_created_at ON upload_sessions(created_at);

-- Function to clean up old uploads (older than 1 hour)
CREATE OR REPLACE FUNCTION cleanup_old_uploads()
RETURNS void AS $$
BEGIN
  -- Delete old chunks
  DELETE FROM upload_chunks 
  WHERE created_at < NOW() - INTERVAL '1 hour';
  
  -- Delete old sessions
  DELETE FROM upload_sessions 
  WHERE created_at < NOW() - INTERVAL '1 hour';
END;
$$ LANGUAGE plpgsql;

-- Grant necessary permissions
GRANT ALL ON upload_chunks TO authenticated;
GRANT ALL ON upload_sessions TO authenticated;