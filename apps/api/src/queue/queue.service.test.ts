import { Logger } from '@nestjs/common';
import type { Job, WorkHandler } from 'pg-boss';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppConfigService, RunMode } from '../config';
import { CLEANUP_USAGE_EVENTS_QUEUE, INGEST_SOURCE_QUEUE } from './queue.jobs';
import { type JobQueue, QueueService } from './queue.service';

const SOURCE = '3a4b5c6d-7e8f-4a0b-9c1d-2e3f4a5b6c7d';
const USER = '0b6c3f1e-1d2a-4c3b-9e4f-5a6b7c8d9e0f';

/** Records every call in order; `send` answers like pg-boss with a job ID. */
class FakeBoss {
  readonly calls: string[] = [];
  readonly send = vi.fn((name: string) => {
    this.calls.push(`send:${name}`);
    return Promise.resolve(this.sendResult);
  });
  readonly work = vi.fn((name: string, _options: object, handler: WorkHandler<unknown>) => {
    this.calls.push(`work:${name}`);
    this.handlers.set(name, handler);
    return Promise.resolve('worker-id');
  });
  readonly schedule = vi.fn((name: string) => {
    this.calls.push(`schedule:${name}`);
    return Promise.resolve();
  });
  readonly createQueue = vi.fn((name: string) => {
    this.calls.push(`createQueue:${name}`);
    return Promise.resolve();
  });
  readonly start = vi.fn(() => {
    this.calls.push('start');
    return Promise.resolve();
  });
  readonly stop = vi.fn(() => Promise.resolve());
  readonly on = vi.fn((event: string, listener: (error: Error) => void) => {
    this.listeners.set(event, listener);
  });
  readonly handlers = new Map<string, WorkHandler<unknown>>();
  readonly listeners = new Map<string, (error: Error) => void>();
  sendResult: string | null = 'job-1';
}

function createService(runMode: RunMode): { service: QueueService; boss: FakeBoss } {
  const boss = new FakeBoss();
  const config = { runMode } as AppConfigService;
  return { service: new QueueService(boss as unknown as JobQueue, config), boss };
}

function job<T>(data: T): Job<T> {
  return { id: 'job-1', name: INGEST_SOURCE_QUEUE, data } as Job<T>;
}

describe('QueueService', () => {
  beforeEach(() => {
    vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('lifecycle', () => {
    it('starts pg-boss, then creates both queues', async () => {
      const { service, boss } = createService('all');

      await service.onModuleInit();

      expect(boss.calls).toEqual([
        'start',
        `createQueue:${INGEST_SOURCE_QUEUE}`,
        `createQueue:${CLEANUP_USAGE_EVENTS_QUEUE}`,
      ]);
    });

    it('makes the singleton key of the ingestion queue effective with the exclusive policy', async () => {
      const { service, boss } = createService('all');

      await service.onModuleInit();

      expect(boss.createQueue).toHaveBeenCalledWith(INGEST_SOURCE_QUEUE, { policy: 'exclusive' });
    });

    it('starts pg-boss in RUN_MODE=api too, because the API enqueues', async () => {
      const { service, boss } = createService('api');

      await service.onModuleInit();

      expect(boss.start).toHaveBeenCalledOnce();
    });

    it('listens for pg-boss errors and logs only their class', async () => {
      const { service, boss } = createService('all');
      await service.onModuleInit();

      boss.listeners.get('error')?.(new TypeError('connect ECONNREFUSED db.secret-host:5432'));

      expect(Logger.prototype.error).toHaveBeenCalledWith({
        message: 'pg-boss error',
        errorClass: 'TypeError',
      });
    });

    it('stops pg-boss gracefully before the database pool closes', async () => {
      const { service, boss } = createService('all');

      await service.beforeApplicationShutdown();

      expect(boss.stop).toHaveBeenCalledWith({ graceful: true, timeout: 10_000 });
    });
  });

  describe('enqueueIngestion', () => {
    it('sends an ingest-source job with the IDs, one per source and three retries', async () => {
      const { service, boss } = createService('all');

      await service.enqueueIngestion(SOURCE, USER);

      expect(boss.send).toHaveBeenCalledWith(
        INGEST_SOURCE_QUEUE,
        { sourceId: SOURCE, userId: USER },
        expect.objectContaining({ singletonKey: SOURCE, retryLimit: 3 }),
      );
    });

    it('enqueues in RUN_MODE=api as well', async () => {
      const { service, boss } = createService('api');

      await service.enqueueIngestion(SOURCE, USER);

      expect(boss.send).toHaveBeenCalledOnce();
    });

    it('accepts a duplicate that pg-boss drops', async () => {
      const { service, boss } = createService('all');
      boss.sendResult = null;

      await expect(service.enqueueIngestion(SOURCE, USER)).resolves.toBeUndefined();
    });

    it('passes a failure on to the caller', async () => {
      const { service, boss } = createService('all');
      boss.send.mockRejectedValueOnce(new Error('connection lost'));

      await expect(service.enqueueIngestion(SOURCE, USER)).rejects.toThrow('connection lost');
    });
  });

  describe('work and schedule', () => {
    it.each<RunMode>(['all', 'worker'])(
      'registers handler and schedule in RUN_MODE=%s',
      async (runMode) => {
        const { service, boss } = createService(runMode);

        await service.work(INGEST_SOURCE_QUEUE, () => Promise.resolve(), { concurrency: 2 });
        await service.schedule(CLEANUP_USAGE_EVENTS_QUEUE, '30 3 * * *');

        expect(boss.work).toHaveBeenCalledWith(
          INGEST_SOURCE_QUEUE,
          { batchSize: 1, localConcurrency: 2 },
          expect.any(Function),
        );
        expect(boss.schedule).toHaveBeenCalledWith(CLEANUP_USAGE_EVENTS_QUEUE, '30 3 * * *', null, {
          tz: 'Europe/Berlin',
        });
      },
    );

    it('registers no handler and no schedule in RUN_MODE=api', async () => {
      const { service, boss } = createService('api');

      await service.work(INGEST_SOURCE_QUEUE, () => Promise.resolve());
      await service.schedule(CLEANUP_USAGE_EVENTS_QUEUE, '30 3 * * *');

      expect(service.runsWorkers).toBe(false);
      expect(boss.work).not.toHaveBeenCalled();
      expect(boss.schedule).not.toHaveBeenCalled();
    });

    it('processes one job at a time by default', async () => {
      const { service, boss } = createService('worker');

      await service.work(INGEST_SOURCE_QUEUE, () => Promise.resolve());

      expect(boss.work).toHaveBeenCalledWith(
        INGEST_SOURCE_QUEUE,
        { batchSize: 1, localConcurrency: 1 },
        expect.any(Function),
      );
    });

    it('hands each fetched job to the handler', async () => {
      const { service, boss } = createService('all');
      const handler = vi.fn(() => Promise.resolve());
      await service.work(INGEST_SOURCE_QUEUE, handler);

      const fetched = job({ sourceId: SOURCE, userId: USER });
      await boss.handlers.get(INGEST_SOURCE_QUEUE)?.([fetched]);

      expect(handler).toHaveBeenCalledWith(fetched);
    });

    it('lets a handler failure reach pg-boss, so it retries the job', async () => {
      const { service, boss } = createService('all');
      await service.work(INGEST_SOURCE_QUEUE, () => Promise.reject(new Error('transient')));

      await expect(
        boss.handlers.get(INGEST_SOURCE_QUEUE)?.([job({ sourceId: SOURCE, userId: USER })]),
      ).rejects.toThrow('transient');
    });
  });
});
