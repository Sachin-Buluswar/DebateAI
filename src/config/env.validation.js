// Environment validation rules
export const envValidationRules = {
  // Required environment variables
  required: [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'OPENAI_API_KEY',
    'ELEVENLABS_API_KEY'
  ],
  
  // Optional environment variables with defaults
  optional: {
    'PORT': '3003',
    'HOST': 'localhost',
    'NODE_ENV': 'development',
    'NEXT_PUBLIC_APP_URL': 'http://localhost:3001',
    'NEXT_PUBLIC_API_URL': 'http://localhost:3003',
    'BACKEND_API_URL': 'http://localhost:3003'
  }
};

export default envValidationRules; 