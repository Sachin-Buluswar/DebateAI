import { createBrowserSupabaseClient } from '@supabase/auth-helpers-nextjs';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Centralised Supabase browser client that **shares the auth cookie** created
 * by `@supabase/auth-helpers-nextjs`. Using this ensures that when a user
 * signs in via `createBrowserSupabaseClient()` (used in the auth form) the
 * session is immediately visible everywhere else (dashboard, API calls, etc.)
 */

let supabase: SupabaseClient;

if (typeof window === 'undefined') {
  // Server-side: fall back to a plain client (we don't have access to cookies).
  // This is fine for public/anon queries inside route handlers.
  // If you need RLS-protected data on the server, use
  // `createServerSupabaseClient` inside the handler instead.
  // We do the `require` to avoid bundling `@supabase/supabase-js` twice.
  // eslint-disable-next-line
  const { createClient } = require('@supabase/supabase-js');
  supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
  );
} else {
  // Client-side – use auth-helpers so sessions share the cookie/localStorage.
  supabase = createBrowserSupabaseClient();
}

export { supabase };
export default supabase; 