import type { SeedEnv } from './seed-env';

export interface SeedTarget {
  /** Host of `DATABASE_URL`, without user, password or database name. */
  databaseHost: string;
  /** Public project URL; safe to log, it is shipped to every browser anyway. */
  supabaseUrl: string;
}

const SUPABASE_PROJECT_HOST = /^([a-z0-9]+)\.supabase\.co$/;
const DIRECT_DATABASE_HOST = /^db\.([a-z0-9]+)\.supabase\.co$/;
// The session pooler host is shared by all projects of a region; the project
// is encoded in the user name instead.
const POOLER_USER = /^postgres\.([a-z0-9]+)$/;

/** Supabase project ref of the database, or `null` for a non-Supabase host. */
function databaseProjectRef(databaseUrl: URL): string | null {
  const fromUser = POOLER_USER.exec(decodeURIComponent(databaseUrl.username));
  return fromUser?.[1] ?? DIRECT_DATABASE_HOST.exec(databaseUrl.hostname)?.[1] ?? null;
}

/**
 * Describes where the seed writes, so the log shows whether dev or prod is
 * affected. Fails if the database and the Auth project belong to different
 * Supabase projects: the demo user would be created in one project and its
 * notebook in another, where the foreign key to `auth.users` cannot hold.
 */
export function resolveSeedTarget(env: Pick<SeedEnv, 'DATABASE_URL' | 'SUPABASE_URL'>): SeedTarget {
  const databaseUrl = new URL(env.DATABASE_URL);
  const supabaseUrl = new URL(env.SUPABASE_URL);

  const dbRef = databaseProjectRef(databaseUrl);
  const authRef = SUPABASE_PROJECT_HOST.exec(supabaseUrl.hostname)?.[1] ?? null;
  if (dbRef !== null && authRef !== null && dbRef !== authRef) {
    throw new Error(
      `DATABASE_URL and SUPABASE_URL point to different Supabase projects (${dbRef} vs. ${authRef})`,
    );
  }

  return { databaseHost: databaseUrl.host, supabaseUrl: supabaseUrl.origin };
}
