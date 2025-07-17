export interface Document {
  id: string;
  title: string;
  file_name: string;
  file_url: string;
  file_size?: number;
  page_count?: number;
  source_url?: string;
  source_type: 'upload' | 'opencaselist' | 'other';
  metadata: Record<string, any>;
  indexed_at?: string;
  created_at: string;
  updated_at: string;
}

export interface DocumentChunk {
  id: string;
  document_id: string;
  chunk_index: number;
  content: string;
  page_number?: number;
  page_start_char?: number;
  page_end_char?: number;
  doc_start_char?: number;
  doc_end_char?: number;
  section_title?: string;
  openai_file_id?: string;
  embedding?: number[];
  metadata: Record<string, any>;
  created_at: string;
}

export interface EnhancedSearchResult {
  content: string;
  source: string;
  score: number;
  chunk_id: string;
  document_id: string;
  page_number?: number;
  pdf_url: string;
  pdf_page_anchor?: string; // For direct PDF navigation
  context: {
    before: string;
    after: string;
  };
  metadata: {
    title: string;
    section?: string;
    source_type: string;
    indexed_at?: string;
  };
}

export interface ScrapeJob {
  id: string;
  url: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  document_id?: string;
  error_message?: string;
  attempted_at?: string;
  completed_at?: string;
  created_at: string;
}