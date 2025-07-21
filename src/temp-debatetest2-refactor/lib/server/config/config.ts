// Eris Debate - Configuration File
// Contains environment variable placeholders for external API integrations
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

interface Config {
  // Supabase Configuration
  supabase: {
    url: string;
    anonKey: string;
    serviceKey: string;
  };
  
  // OpenAI Configuration
  openai: {
    apiKey: string;
    vectorFileId: string;
  };
  
  // Server Configuration
  server: {
    port: number;
    host: string;
  };
}

const config: Config = {
  supabase: {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
    serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  },
  
  openai: {
    apiKey: process.env.OPENAI_API_KEY || '',
    vectorFileId: process.env.OPENAI_VECTOR_FILE_ID || '',
  },
  
  server: {
    port: parseInt(process.env.PORT || '3001', 10),
    host: process.env.HOST || 'localhost',
  },
};

export default config; 