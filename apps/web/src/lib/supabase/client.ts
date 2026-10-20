import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseEnv } from './env';

/**
 * Supabase client for the browser, used for the login only. It stores the session in cookies,
 * so `proxy.ts` sees the same session. In the browser it is a singleton, repeated calls are cheap.
 */
export function createSupabaseBrowserClient(): SupabaseClient {
  const { url, anonKey } = getSupabaseEnv();
  return createBrowserClient(url, anonKey);
}
