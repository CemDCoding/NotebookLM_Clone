import { Module } from '@nestjs/common';
import { QueueModule } from '../queue/queue.module';
import { LimitTransactions } from './limit-transactions';
import { LimitsRepository } from './limits.repository';
import { LimitsService } from './limits.service';
import { SourceCountsRepository } from './source-counts.repository';
import { UsageCleanupJob } from './usage-cleanup.job';
import { UsageEventsRepository } from './usage-events.repository';

/**
 * Central check of all business limits, counted in the database, and the
 * daily cleanup of the usage log (apps/api/CLAUDE.md "limits").
 */
@Module({
  imports: [QueueModule],
  providers: [
    UsageCleanupJob,
    LimitsService,
    LimitsRepository,
    LimitTransactions,
    SourceCountsRepository,
    UsageEventsRepository,
  ],
  exports: [LimitsService],
})
export class LimitsModule {}
