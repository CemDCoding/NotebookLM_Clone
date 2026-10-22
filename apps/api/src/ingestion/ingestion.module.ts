import { Module } from '@nestjs/common';

/**
 * pg-boss worker that turns a source into embedded chunks
 * (apps/api/CLAUDE.md "sources und ingestion"). Registered only in the modes
 * `all` and `worker`, so a pure API instance never processes jobs.
 * Filled in by M3-API-05.
 */
@Module({})
export class IngestionModule {}
