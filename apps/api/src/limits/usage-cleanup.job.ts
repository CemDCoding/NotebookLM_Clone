import { Inject, Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { lt } from 'drizzle-orm';
import { type Database, DRIZZLE } from '../db/db.module';
import { usageEvents } from '../db/schema';
import { CLEANUP_USAGE_EVENTS_QUEUE } from '../queue/queue.jobs';
import { QueueService } from '../queue/queue.service';

// The longest limit window is one day; a week of events is plenty for every
// check and keeps the counting log small (CLAUDE.md section 4).
export const USAGE_EVENT_RETENTION_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;
// Daily at 03:30 German time, outside the hours the demo is used.
export const USAGE_CLEANUP_CRON = '30 3 * * *';

/** Events created before this instant are deleted. */
export function usageCleanupCutoff(now: Date): Date {
  return new Date(now.getTime() - USAGE_EVENT_RETENTION_DAYS * DAY_MS);
}

/**
 * Daily pg-boss job that deletes `usage_events` older than 7 days
 * (apps/api/CLAUDE.md "limits"). Events carry no content, so this is about
 * table size, not privacy. Registered only where workers run.
 */
@Injectable()
export class UsageCleanupJob implements OnApplicationBootstrap {
  private readonly logger = new Logger(UsageCleanupJob.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly queue: QueueService,
  ) {}

  // After every `onModuleInit`, so pg-boss has started.
  async onApplicationBootstrap(): Promise<void> {
    await this.queue.work(CLEANUP_USAGE_EVENTS_QUEUE, async () => {
      await this.run();
    });
    await this.queue.schedule(CLEANUP_USAGE_EVENTS_QUEUE, USAGE_CLEANUP_CRON);
  }

  /** Deletes the expired events and returns how many there were. */
  async run(now: Date = new Date()): Promise<number> {
    const result = await this.db
      .delete(usageEvents)
      .where(lt(usageEvents.createdAt, usageCleanupCutoff(now)));
    this.logger.log({ message: 'Usage events cleaned up', deleted: result.count });
    return result.count;
  }
}
