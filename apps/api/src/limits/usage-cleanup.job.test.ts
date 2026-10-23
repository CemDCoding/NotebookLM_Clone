import { Logger } from '@nestjs/common';
import { type SQL, sql } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Database } from '../db/db.module';
import { usageEvents } from '../db/schema';
import { CLEANUP_USAGE_EVENTS_QUEUE } from '../queue/queue.jobs';
import type { QueueService } from '../queue/queue.service';
import { USAGE_CLEANUP_CRON, UsageCleanupJob, usageCleanupCutoff } from './usage-cleanup.job';

const NOW = new Date('2026-10-22T03:30:00.000Z');

/** Captures the table and condition of `db.delete(table).where(condition)`. */
function fakeDb(deleted: number): { db: Database; deletes: { table: unknown; where: SQL }[] } {
  const deletes: { table: unknown; where: SQL }[] = [];
  const db = {
    delete: (table: unknown) => ({
      where: (where: SQL) => {
        deletes.push({ table, where });
        return Promise.resolve({ count: deleted });
      },
    }),
  } as unknown as Database;
  return { db, deletes };
}

function fakeQueue(): Pick<QueueService, 'work' | 'schedule'> {
  return {
    work: vi.fn(() => Promise.resolve()),
    schedule: vi.fn(() => Promise.resolve()),
  };
}

describe('usageCleanupCutoff', () => {
  it('lies exactly seven days before now', () => {
    expect(usageCleanupCutoff(NOW)).toEqual(new Date('2026-10-15T03:30:00.000Z'));
  });
});

describe('UsageCleanupJob', () => {
  beforeEach(() => {
    vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('deletes the usage events created before the cutoff, of every user and kind', async () => {
    const { db, deletes } = fakeDb(4);
    const job = new UsageCleanupJob(db, fakeQueue() as QueueService);

    await expect(job.run(NOW)).resolves.toBe(4);

    expect(deletes).toHaveLength(1);
    expect(deletes[0]?.table).toBe(usageEvents);
    const query = new PgDialect().sqlToQuery(sql`${deletes[0]?.where}`);
    expect(query.sql).toBe('"usage_events"."created_at" < $1');
    expect(query.params).toEqual([usageCleanupCutoff(NOW).toISOString()]);
  });

  it('logs only the number of deleted events', async () => {
    const job = new UsageCleanupJob(fakeDb(2).db, fakeQueue() as QueueService);

    await job.run(NOW);

    expect(Logger.prototype.log).toHaveBeenCalledWith({
      message: 'Usage events cleaned up',
      deleted: 2,
    });
  });

  it('registers its handler and the daily schedule on bootstrap', async () => {
    const queue = fakeQueue();
    const job = new UsageCleanupJob(fakeDb(0).db, queue as QueueService);

    await job.onApplicationBootstrap();

    expect(queue.work).toHaveBeenCalledWith(CLEANUP_USAGE_EVENTS_QUEUE, expect.any(Function));
    expect(queue.schedule).toHaveBeenCalledWith(CLEANUP_USAGE_EVENTS_QUEUE, USAGE_CLEANUP_CRON);
  });

  it('runs the cleanup when pg-boss hands it a job', async () => {
    const queue = fakeQueue();
    const { db, deletes } = fakeDb(0);
    await new UsageCleanupJob(db, queue as QueueService).onApplicationBootstrap();

    const handler = vi.mocked(queue.work).mock.calls[0]?.[1];
    await handler?.({} as never);

    expect(deletes).toHaveLength(1);
  });
});
