import { Module } from '@nestjs/common';
import { LimitsRepository } from './limits.repository';
import { LimitsService } from './limits.service';

/**
 * Central check of all business limits, counted in the database
 * (apps/api/CLAUDE.md "limits").
 */
@Module({
  providers: [LimitsService, LimitsRepository],
  exports: [LimitsService],
})
export class LimitsModule {}
