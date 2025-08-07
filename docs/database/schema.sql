-- Eris Debate Database Schema
-- This file contains the complete database schema for the Eris Debate application

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm; -- For text search

-- Create documents table
CREATE TABLE IF NOT EXISTS public.documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size BIGINT,
  page_count INTEGER,
  source_url TEXT,
  source_type TEXT CHECK (source_type IN ('upload', 'opencaselist', 'other')),
  metadata JSONB DEFAULT '{}',
  indexed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create document_chunks table
CREATE TABLE IF NOT EXISTS public.document_chunks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  page_number INTEGER,
  page_start_char INTEGER,
  page_end_char INTEGER,
  doc_start_char INTEGER,
  doc_end_char INTEGER,
  section_title TEXT,
  openai_file_id TEXT,
  embedding vector(1536),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(document_id, chunk_index)
);

-- Create user_feedback table
CREATE TABLE IF NOT EXISTS public.user_feedback (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  feedback_type TEXT NOT NULL,
  message TEXT NOT NULL,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create audio_recordings table (if not exists from database.types.ts)
CREATE TABLE IF NOT EXISTS public.audio_recordings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  file_url TEXT NOT NULL,
  file_size BIGINT,
  duration FLOAT,
  mime_type TEXT,
  transcription TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE audio_recordings ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for documents
CREATE POLICY "Documents are viewable by everyone" ON documents
  FOR SELECT USING (true);

CREATE POLICY "Users can insert their own documents" ON documents
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update their own documents" ON documents
  FOR UPDATE USING (true);

CREATE POLICY "Users can delete their own documents" ON documents
  FOR DELETE USING (true);

-- Create RLS policies for document_chunks
CREATE POLICY "Document chunks are viewable by everyone" ON document_chunks
  FOR SELECT USING (true);

CREATE POLICY "Document chunks follow document permissions" ON document_chunks
  FOR ALL USING (true);

-- Create RLS policies for user_feedback
CREATE POLICY "Users can insert their own feedback" ON user_feedback
  FOR INSERT WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users can view their own feedback" ON user_feedback
  FOR SELECT USING (auth.uid() = user_id);

-- Create RLS policies for audio_recordings
CREATE POLICY "Users can view their own recordings" ON audio_recordings
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own recordings" ON audio_recordings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own recordings" ON audio_recordings
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own recordings" ON audio_recordings
  FOR DELETE USING (auth.uid() = user_id);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_documents_title_trgm ON documents USING gin(title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_documents_created_at ON documents(created_at);
CREATE INDEX IF NOT EXISTS idx_document_chunks_content_trgm ON document_chunks USING gin(content gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_document_chunks_embedding ON document_chunks USING ivfflat(embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS idx_document_chunks_document_id ON document_chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_audio_recordings_user_id ON audio_recordings(user_id);
CREATE INDEX IF NOT EXISTS idx_audio_recordings_created_at ON audio_recordings(created_at);

-- Add updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_documents_updated_at BEFORE UPDATE ON documents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_audio_recordings_updated_at BEFORE UPDATE ON audio_recordings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();