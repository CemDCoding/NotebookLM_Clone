import type { IngestSourceJob, QueueName } from '../../src/queue/queue.jobs';
import type { QueueJob, QueueService, WorkOptions } from '../../src/queue/queue.service';
import type { CallLog } from './in-memory-sources';

/** A handler registered with `work`, kept so a test can hand it jobs itself. */
export interface RegisteredWorker {
  name: QueueName;
  handler: (job: QueueJob<unknown>) => Promise<void>;
  options: WorkOptions;
}

/**
 * Stand-in for `QueueService` in tests: it records enqueued ingestion jobs
 * and registered handlers instead of talking to pg-boss.
 */
export class FakeQueue implements Pick<QueueService, 'enqueueIngestion' | 'work'> {
  readonly ingestionJobs: IngestSourceJob[] = [];
  readonly workers: RegisteredWorker[] = [];
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

  work<T>(
    name: QueueName,
    handler: (job: QueueJob<T>) => Promise<void>,
    options: WorkOptions = {},
  ): Promise<void> {
    this.workers.push({
      name,
      handler: handler as (job: QueueJob<unknown>) => Promise<void>,
      options,
    });
    return Promise.resolve();
  }
}
