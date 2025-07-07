import { createClient } from '@supabase/supabase-js';
import { env } from '@/shared/env';

// This client is safe to use on the server-side only.
// It uses the service role key and has admin privileges.
export const supabaseAdmin = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
); 