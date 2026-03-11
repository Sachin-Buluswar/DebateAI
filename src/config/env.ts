import { z } from 'zod';

const clientSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
});

// Allow placeholder keys in development
const isDevMode = process.env.NODE_ENV === 'development';

const serverSchema = z.object({
  OPENAI_API_KEY: z.string().min(1),
  ELEVENLABS_API_KEY: isDevMode 
    ? z.string().optional().default('sk_placeholder_key_for_elevenlabs')
    : z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  ELEVENLABS_STT_MODEL_ID: z.string().optional(),
  ELEVENLABS_DEBATE_AGENT_ID: z.string().optional(),
  OPENAI_VECTOR_STORE_ID: z.string().optional(),
  PORT: z.string().optional().default('3000'),
});

const mergedSchema = serverSchema.merge(clientSchema);

// This object will hold the validated environment variables.
let env: z.infer<typeof mergedSchema>;

// Server-side validation
if (typeof window === 'undefined') {
  const serverEnv = {
    // Server
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    ELEVENLABS_API_KEY: process.env.ELEVENLABS_API_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    ELEVENLABS_STT_MODEL_ID: process.env.ELEVENLABS_STT_MODEL_ID,
    ELEVENLABS_DEBATE_AGENT_ID: process.env.ELEVENLABS_DEBATE_AGENT_ID,
    OPENAI_VECTOR_STORE_ID: process.env.OPENAI_VECTOR_STORE_ID,
    PORT: process.env.PORT,
    // Client
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  };
  
  const parsed = mergedSchema.safeParse(serverEnv);

  if (!parsed.success) {
    if (!isDevMode) {
      // In production, throw an error with minimal information
      throw new Error('Missing required environment variables. Please check server configuration.');
    } else {
      // In development, throw error to force proper setup
      throw new Error(
        'Missing environment variables in development. Please copy .env.example to .env.local and fill in your values.'
      );
    }
  } else {
    env = parsed.data;
  }
} else {
  // Client-side validation
  const clientEnv = {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  };
  
  const parsed = clientSchema.safeParse(clientEnv);

  if (!parsed.success) {
    throw new Error('Invalid client-side environment variables.');
  }

  // To maintain type safety, we cast the client-only env to the full schema.
  // Server-side variables will be `undefined` at runtime on the client.
  env = parsed.data as z.infer<typeof mergedSchema>;
}

export { env }; 