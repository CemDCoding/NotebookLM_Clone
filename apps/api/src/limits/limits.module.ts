import { Module } from '@nestjs/common';
import { LimitTransactions } from './limit-transactions';
import { LimitsRepository } from './limits.repository';
import { LimitsService } from './limits.service';
import { SourceCountsRepository } from './source-counts.repository';
import { UsageEventsRepository } from './usage-events.repository';

/**
 * Central check of all business limits, counted in the database
 * (apps/api/CLAUDE.md "limits").
 */
@Module({
  providers: [
    LimitsService,
    LimitsRepository,
    LimitTransactions,
    SourceCountsRepository,
    UsageEventsRepository,
  ],
  exports: [LimitsService],
})
export class LimitsModule {}
