import { createClient as createSupabaseClient } from '@/utils/supabase/client';
import { createClient } from '@supabase/supabase-js';

/**
 * Centralised Supabase browser client that shares the auth cookie using
 * the modern SSR pattern for Next.js 13+ app directory.
 * 
 * Note: This client is for use in client components only.
 * For server components and API routes, use createClient from '@/utils/supabase/server'
 * 
 * IMPORTANT: This exports a singleton for backward compatibility.
 * The singleton pattern can cause auth state synchronization issues.
 * Consider using createSupabaseClient() directly for better auth handling.
 */

let supabase: ReturnType<typeof createSupabaseClient>;

// Create the client lazily on first access
function getSupabaseClient() {
  if (typeof window === 'undefined') {
    // Server-side during build: create a dummy client
    // This is only used during build time and won't be used at runtime
    return createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://dummy.supabase.co',
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'dummy-key',
      {
        auth: {
          persistSession: false,
        }
      }
    );
  }
  
  // Client-side: always create a fresh client for better auth state handling
  // This ensures auth state changes are properly reflected
  if (!supabase) {
    supabase = createSupabaseClient();
  }
  return supabase;
}

// Export the singleton for backward compatibility
supabase = getSupabaseClient();

export { supabase };
export default supabase;

// Export function to create fresh client instances
export { createSupabaseClient }; 