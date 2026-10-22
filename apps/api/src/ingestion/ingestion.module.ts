import { Module } from '@nestjs/common';
import { LlmModule } from '../llm/llm.module';
import { QueueModule } from '../queue/queue.module';
import { StorageModule } from '../storage/storage.module';
import { IngestionRepository } from './ingestion.repository';
import { IngestionWorker } from './ingestion.worker';

/**
 * pg-boss worker that turns a source into embedded chunks
 * (apps/api/CLAUDE.md "sources und ingestion"). Registered only in the modes
 * `all` and `worker`, so a pure API instance never processes jobs.
 */
@Module({
  imports: [QueueModule, StorageModule, LlmModule],
  providers: [IngestionRepository, IngestionWorker],
})
export class IngestionModule {}
