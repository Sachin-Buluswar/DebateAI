// Set up environment variables for testing
process.env.OPENAI_API_KEY = 'test-openai-key';
process.env.PINECONE_API_KEY = 'test-pinecone-key';
process.env.PINECONE_ENVIRONMENT = 'test-environment';
process.env.PINECONE_INDEX = 'test-index';
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test-supabase-url.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-supabase-anon-key';
process.env.PORT = '3001';
process.env.HOST = 'localhost';

// Mock implementations for browser APIs not available in Node.js
global.URL.createObjectURL = jest.fn(() => 'mock-url');
global.Blob = class Blob {
  constructor(content, options) {
    this.content = content;
    this.options = options;
    this.size = 1024;
    this.type = options?.type || '';
  }
  
  arrayBuffer() {
    return Promise.resolve(Buffer.from('test').buffer);
  }
}; 