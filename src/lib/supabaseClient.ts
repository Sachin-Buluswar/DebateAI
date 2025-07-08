import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Centralised Supabase browser client that shares the auth cookie using
 * the modern auth-helpers pattern for Next.js 13+ app directory.
 */

let supabase: SupabaseClient;

if (typeof window === 'undefined') {
  // Server-side: use plain client for server components and API routes
  supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
    {
      auth: {
        persistSession: false,
      }
    }
  );
} else {
  // Client-side: use modern auth-helpers for app directory
  supabase = createClientComponentClient();
}

export { supabase };
export default supabase; 