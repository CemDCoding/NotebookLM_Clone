// Resets the demo account, its notebook and the sample source (CLAUDE.md section 7 "Demo-Account").
//
//   pnpm --filter api db:seed       development, variables from apps/api/.env
//   pnpm --filter api db:seed:prod  production, variables only from apps/api/.env.production
//
// The ingestion job is only enqueued; a running API (RUN_MODE all) or worker processes it.
import { join } from 'node:path';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { QueueService } from '../queue/queue.service';
import { StorageService } from '../storage/storage.service';
import { seedDemoAccount } from './seed/demo-seed';
import { loadDemoSource } from './seed/demo-source';
import { DrizzleDemoNotebooks } from './seed/drizzle-demo-notebooks';
import { DrizzleDemoSources } from './seed/drizzle-demo-sources';
import { loadSeedEnv } from './seed/seed-env';
import { SeedModule } from './seed/seed.module';
import { resolveSeedTarget } from './seed/seed-target';
import { SupabaseUserAdmin } from './seed/supabase-user-admin';

// apps/api/.env, resolved from src/db.
const DOTENV_PATH = join(__dirname, '..', '..', '.env');

async function main(logger: Logger): Promise<void> {
  const { env, source } = loadSeedEnv({
    execArgv: process.execArgv,
    env: process.env,
    dotenvPath: DOTENV_PATH,
  });
  const target = resolveSeedTarget(env.app);
  logger.log(
    source === 'env-file'
      ? 'Variables from --env-file and the shell only, apps/api/.env is not read'
      : 'Variables from the shell and apps/api/.env',
  );
  logger.log(`Target database host: ${target.databaseHost}`);
  logger.log(`Target Supabase project: ${target.supabaseUrl}`);

  const sampleSource = loadDemoSource();
  const app = await NestFactory.createApplicationContext(SeedModule.forRoot(env.app));
  try {
    await seedDemoAccount(
      { credentials: env.demo, sampleSource },
      {
        users: app.get(SupabaseUserAdmin),
        notebooks: app.get(DrizzleDemoNotebooks),
        sources: app.get(DrizzleDemoSources),
        storage: app.get(StorageService),
        queue: app.get(QueueService),
        logger,
      },
    );
    logger.log('Seed finished');
  } finally {
    // Stops pg-boss before the database pool, so the process can exit.
    await app.close();
  }
}

const logger = new Logger('Seed');
main(logger).catch((error: unknown) => {
  // The seed's own errors name variables and IDs only, never values.
  logger.error(error instanceof Error ? `${error.name}: ${error.message}` : 'Unknown error');
  process.exitCode = 1;
});
