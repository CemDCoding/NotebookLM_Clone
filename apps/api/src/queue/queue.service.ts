import {
  type BeforeApplicationShutdown,
  Inject,
  Injectable,
  Logger,
  type OnModuleInit,
} from '@nestjs/common';
import type { Job, PgBoss, Queue } from 'pg-boss';
import { AppConfigService } from '../config';
import {
  CLEANUP_USAGE_EVENTS_QUEUE,
  INGEST_SOURCE_QUEUE,
  type IngestSourceJob,
  type QueueName,
} from './queue.jobs';

/** Injection token of the pg-boss instance, so tests can replace it without a database. */
export const PG_BOSS = Symbol('PG_BOSS');

/** The part of pg-boss the service uses. */
export type JobQueue = Pick<
  PgBoss,
  'on' | 'start' | 'stop' | 'createQueue' | 'send' | 'work' | 'schedule'
>;

export type QueueJob<T> = Job<T>;

export interface WorkOptions {
  /** Jobs this instance processes at the same time. Default 1. */
  concurrency?: number;
}

// pg-boss retries a failed ingestion up to three times (PE-14). The delay
// doubles from 30 s, so a provider outage or rate limit has time to pass
// instead of burning all attempts within a second.
const INGEST_RETRY_LIMIT = 3;
const INGEST_RETRY_DELAY_SECONDS = 30;
// How long a graceful stop waits for running jobs before it gives up.
const STOP_TIMEOUT_MS = 10_000;

const QUEUES: readonly { name: QueueName; options: Omit<Queue, 'name'> }[] = [
  // `exclusive` makes the singleton key effective: at most one queued or
  // running job per source, so a duplicate enqueue is dropped instead of
  // ingesting the same source twice in parallel.
  { name: INGEST_SOURCE_QUEUE, options: { policy: 'exclusive' } },
  { name: CLEANUP_USAGE_EVENTS_QUEUE, options: {} },
];

/**
 * Lifecycle of pg-boss and the only way the app talks to it
 * (apps/api/CLAUDE.md "sources und ingestion", "RUN_MODE"). Every mode
 * starts pg-boss, because the API enqueues; only `all` and `worker` register
 * handlers and schedules, so a pure API instance never processes jobs.
 */
@Injectable()
export class QueueService implements OnModuleInit, BeforeApplicationShutdown {
  private readonly logger = new Logger(QueueService.name);

  constructor(
    @Inject(PG_BOSS) private readonly boss: JobQueue,
    private readonly config: AppConfigService,
  ) {}

  /** Whether this instance processes jobs (RUN_MODE `all` or `worker`). */
  get runsWorkers(): boolean {
    return this.config.runMode !== 'api';
  }

  async onModuleInit(): Promise<void> {
    // pg-boss emits connection and maintenance errors as events. Without a
    // listener, an `error` event would crash the process. Only the class is
    // logged: the message can contain SQL or connection details.
    this.boss.on('error', (error) => {
      this.logger.error({ message: 'pg-boss error', errorClass: error.constructor.name });
    });
    await this.boss.start();
    // Idempotent: an existing queue keeps its stored options.
    for (const queue of QUEUES) {
      await this.boss.createQueue(queue.name, queue.options);
    }
  }

  /**
   * Runs before the database pool closes in `onApplicationShutdown`, so
   * running jobs can still finish their writes.
   */
  async beforeApplicationShutdown(): Promise<void> {
    await this.boss.stop({ graceful: true, timeout: STOP_TIMEOUT_MS });
  }

  /** Enqueues the ingestion of a new source. A second job for the same source is dropped. */
  async enqueueIngestion(sourceId: string, userId: string): Promise<void> {
    const payload: IngestSourceJob = { sourceId, userId };
    const jobId = await this.boss.send(INGEST_SOURCE_QUEUE, payload, {
      singletonKey: sourceId,
      retryLimit: INGEST_RETRY_LIMIT,
      retryDelay: INGEST_RETRY_DELAY_SECONDS,
      retryBackoff: true,
    });
    this.logger.log({
      message: jobId === null ? 'Ingestion already queued' : 'Ingestion queued',
      sourceId,
      jobId,
    });
  }

  /**
   * Registers a handler for a queue, one job per call. A no-op in RUN_MODE
   * `api`. A throw fails the job, and pg-boss retries it up to its retry
   * limit. Call it from `onApplicationBootstrap`, after pg-boss has started.
   */
  async work<T>(
    name: QueueName,
    handler: (job: QueueJob<T>) => Promise<void>,
    options: WorkOptions = {},
  ): Promise<void> {
    if (!this.runsWorkers) {
      return;
    }
    await this.boss.work<T>(
      name,
      { batchSize: 1, localConcurrency: options.concurrency ?? 1 },
      async (jobs) => {
        for (const job of jobs) {
          await handler(job);
        }
      },
    );
  }

  /**
   * Schedules a recurring job by cron expression, in German time. A no-op in
   * RUN_MODE `api`, like `work`: the schedule belongs to the instance that
   * processes it. Rescheduling on every start overwrites the stored schedule.
   */
  async schedule(name: QueueName, cron: string): Promise<void> {
    if (!this.runsWorkers) {
      return;
    }
    await this.boss.schedule(name, cron, null, { tz: 'Europe/Berlin' });
  }
}
