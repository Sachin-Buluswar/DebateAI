import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * Centralised Supabase client used throughout the frontend.
 * ALWAYS import from this module instead of creating your own client.
 */
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  // Throwing in module scope breaks Next.js dev hot reload. Log instead.
  // env.validation.js script should already fail CI if these are missing.
  // eslint-disable-next-line no-console
  console.error('Supabase env vars are missing. \nNEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY not set.');
}

export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey);

export default supabase; 