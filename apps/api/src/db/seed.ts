// Resets the demo account and its notebook (CLAUDE.md section 7 "Demo-Account").
//
//   pnpm --filter api db:seed       development, variables from apps/api/.env
//   pnpm --filter api db:seed:prod  production, variables only from apps/api/.env.production
import { join } from 'node:path';
import { Logger } from '@nestjs/common';
import { createClient } from '@supabase/supabase-js';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
import { seedDemoAccount } from './seed/demo-seed';
import { DrizzleDemoNotebooks } from './seed/drizzle-demo-notebooks';
import { loadSeedEnv } from './seed/seed-env';
import { resolveSeedTarget } from './seed/seed-target';
import { SupabaseUserAdmin } from './seed/supabase-user-admin';

// apps/api/.env, resolved from src/db.
const DOTENV_PATH = join(__dirname, '..', '..', '.env');
const CONNECT_TIMEOUT_SECONDS = 10;
const SHUTDOWN_TIMEOUT_SECONDS = 5;

async function main(logger: Logger): Promise<void> {
  const { env, source } = loadSeedEnv({
    execArgv: process.execArgv,
    env: process.env,
    dotenvPath: DOTENV_PATH,
  });
  const target = resolveSeedTarget(env);
  logger.log(
    source === 'env-file'
      ? 'Variables from --env-file and the shell only, apps/api/.env is not read'
      : 'Variables from the shell and apps/api/.env',
  );
  logger.log(`Target database host: ${target.databaseHost}`);
  logger.log(`Target Supabase project: ${target.supabaseUrl}`);

  const sql = postgres(env.DATABASE_URL, {
    max: 1,
    connect_timeout: CONNECT_TIMEOUT_SECONDS,
    onnotice: () => undefined,
  });
  try {
    const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      // A one-off admin script: no session to keep or refresh.
      auth: { autoRefreshToken: false, persistSession: false },
    });
    await seedDemoAccount(
      { email: env.DEMO_USER_EMAIL, password: env.DEMO_USER_PASSWORD },
      {
        users: new SupabaseUserAdmin(supabase),
        notebooks: new DrizzleDemoNotebooks(drizzle(sql, { schema })),
        logger,
      },
    );
    logger.log('Seed finished');
  } finally {
    await sql.end({ timeout: SHUTDOWN_TIMEOUT_SECONDS });
  }
}

const logger = new Logger('Seed');
main(logger).catch((error: unknown) => {
  // The seed's own errors name variables and IDs only, never values.
  logger.error(error instanceof Error ? `${error.name}: ${error.message}` : 'Unknown error');
  process.exitCode = 1;
});
