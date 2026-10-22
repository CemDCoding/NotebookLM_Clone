import { Module } from '@nestjs/common';

/**
 * pg-boss job queue (apps/api/CLAUDE.md "sources und ingestion", "RUN_MODE").
 * Loaded in every mode: the API enqueues `ingest-source` jobs, the worker
 * processes them. pg-boss keeps its own `pgboss` schema outside Drizzle.
 * Filled in by M3-API-04.
 */
@Module({})
export class QueueModule {}
