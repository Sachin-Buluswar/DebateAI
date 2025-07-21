import { createClient as createSupabaseClient } from '@/utils/supabase/client';
import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Centralised Supabase browser client that shares the auth cookie using
 * the modern SSR pattern for Next.js 13+ app directory.
 * 
 * Note: This client is for use in client components only.
 * For server components and API routes, use createClient from '@/utils/supabase/server'
 */

let supabase: SupabaseClient;

if (typeof window === 'undefined') {
  // Server-side during build: create a dummy client
  // This is only used during build time and won't be used at runtime
  supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://dummy.supabase.co',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'dummy-key',
    {
      auth: {
        persistSession: false,
      }
    }
  );
} else {
  // Client-side: use the SSR client
  supabase = createSupabaseClient();
}

export { supabase };
export default supabase; 