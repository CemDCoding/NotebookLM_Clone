interface SupabaseEnv {
  url: string;
  anonKey: string;
}

/** Public Supabase settings for the login. Fails loudly instead of creating a client without a project. */
export function getSupabaseEnv(): SupabaseEnv {
  // Literal property access is required: Next.js only inlines NEXT_PUBLIC_ variables written out in full.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set');
  }

  return { url, anonKey };
}
