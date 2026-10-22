import { Module } from '@nestjs/common';
import { PgBoss } from 'pg-boss';
import { AppConfigService } from '../config';
import { type JobQueue, PG_BOSS, QueueService } from './queue.service';

// Supabase Free limits the connections of the session pooler, which pg-boss
// shares with Drizzle (PE-12: Drizzle 5, pg-boss 3).
const POOL_MAX = 3;

/**
 * pg-boss job queue (apps/api/CLAUDE.md "sources und ingestion", "RUN_MODE").
 * Loaded in every mode: the API enqueues `ingest-source` jobs, the worker
 * processes them. pg-boss keeps its own `pgboss` schema outside Drizzle and
 * connects through the session pooler like Drizzle (docs/deployment.md).
 */
@Module({
  providers: [
    {
      provide: PG_BOSS,
      inject: [AppConfigService],
      // pg-boss 12 is ESM-only; the CommonJS build loads it through Node's
      // `require(esm)` (PE-19). Constructing it does not connect yet.
      useFactory: (config: AppConfigService): JobQueue =>
        new PgBoss({
          connectionString: config.databaseUrl,
          max: POOL_MAX,
          application_name: 'notebooklm-api',
          // Only an instance that processes jobs turns schedules into jobs.
          schedule: config.runMode !== 'api',
        }),
    },
    QueueService,
  ],
  exports: [QueueService],
})
export class QueueModule {}
