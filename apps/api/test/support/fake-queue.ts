import type { IngestSourceJob } from '../../src/queue/queue.jobs';
import type { QueueService } from '../../src/queue/queue.service';
import type { CallLog } from './in-memory-sources';

/**
 * Stand-in for `QueueService` in tests that build the sources feature: it
 * records enqueued ingestion jobs instead of writing them to pg-boss.
 */
export class FakeQueue implements Pick<QueueService, 'enqueueIngestion'> {
  readonly ingestionJobs: IngestSourceJob[] = [];
  /** Makes the next `enqueueIngestion` fail, like an unreachable database. */
  failNextEnqueue = false;

  constructor(private readonly calls: CallLog = []) {}

  enqueueIngestion(sourceId: string, userId: string): Promise<void> {
    this.calls.push(`queue:enqueue:${sourceId}`);
    if (this.failNextEnqueue) {
      this.failNextEnqueue = false;
      return Promise.reject(new Error('Queue unavailable'));
    }
    this.ingestionJobs.push({ sourceId, userId });
    return Promise.resolve();
  }
}
