import { randomUUID } from 'node:crypto';
import { DEFAULT_LIMITS, ErrorCode, type Limits } from '@notebooklm/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { asRepositories, InMemoryNotebooks } from '../../test/support/in-memory-notebooks';
import { LimitExceededError } from '../common/errors';
import type { AppConfigService } from '../config';
import type { LimitTransaction, LimitTransactions } from './limit-transactions';
import type { LimitsRepository } from './limits.repository';
import { GLOBAL_UPLOAD_LOCK_KEY, LimitsService } from './limits.service';
import type { SourceCountsRepository } from './source-counts.repository';
import type { UsageEventKind, UsageEventsRepository } from './usage-events.repository';

const USER = '0b6c3f1e-1d2a-4c3b-9e4f-5a6b7c8d9e0f';
const OTHER_USER = '7d8e9f0a-1b2c-4d3e-8f4a-5b6c7d8e9f0a';
const NOTEBOOK = '3a4b5c6d-7e8f-4a0b-9c1d-2e3f4a5b6c7d';
const OTHER_NOTEBOOK = '9f8e7d6c-5b4a-4c2d-8e1f-0a9b8c7d6e5f';

interface UsageEvent {
  kind: UsageEventKind;
  userId: string;
  createdAt: Date;
}

interface SourceRow {
  id: string;
  userId: string;
  notebookId: string;
}

/**
 * In-memory stand-in for the tables behind the upload limits. Sources are
 * added and deleted the way the sources module will do it; usage events are
 * written only through the repository, like in the real flow.
 */
class InMemoryUploadTables {
  readonly events: UsageEvent[] = [];
  private readonly sources: SourceRow[] = [];

  addSource(userId: string, notebookId: string): string {
    const id = randomUUID();
    this.sources.push({ id, userId, notebookId });
    return id;
  }

  deleteSource(id: string): void {
    const index = this.sources.findIndex((row) => row.id === id);
    this.sources.splice(index, 1);
  }

  countSources(userId: string, notebookId: string): number {
    return this.sources.filter((row) => row.userId === userId && row.notebookId === notebookId)
      .length;
  }
}

/**
 * Serialises `run` calls like the advisory lock does and records the lock
 * keys and the transaction each query ran on.
 */
class FakeLimitTransactions {
  readonly lockKeys: string[][] = [];
  readonly tx = { fake: 'transaction' } as unknown as LimitTransaction;
  private queue: Promise<unknown> = Promise.resolve();

  run<T>(lockKeys: readonly string[], work: (tx: LimitTransaction) => Promise<T>): Promise<T> {
    this.lockKeys.push([...lockKeys]);
    const result = this.queue.then(() => work(this.tx));
    this.queue = result.catch(() => undefined);
    return result;
  }
}

interface UploadFixture {
  limits: LimitsService;
  tables: InMemoryUploadTables;
  transactions: FakeLimitTransactions;
  txSeen: LimitTransaction[];
}

function createUploadService(overrides: Partial<Limits>): UploadFixture {
  const tables = new InMemoryUploadTables();
  const transactions = new FakeLimitTransactions();
  const txSeen: LimitTransaction[] = [];

  const sourceCounts: SourceCountsRepository = {
    countSources: (tx, userId, notebookId) => {
      txSeen.push(tx);
      return Promise.resolve(tables.countSources(userId, notebookId));
    },
  };
  const usageEvents: UsageEventsRepository = {
    countSince: (tx, kind, since, userId) => {
      txSeen.push(tx);
      const count = tables.events.filter(
        (event) =>
          event.kind === kind &&
          event.createdAt >= since &&
          (userId === undefined || event.userId === userId),
      ).length;
      return Promise.resolve(count);
    },
    insert: (tx, kind, userId) => {
      txSeen.push(tx);
      tables.events.push({ kind, userId, createdAt: new Date() });
      return Promise.resolve();
    },
  };
  const config = { limits: { ...DEFAULT_LIMITS, ...overrides } } as AppConfigService;

  const limits = new LimitsService(
    {} as LimitsRepository,
    config,
    transactions as unknown as LimitTransactions,
    sourceCounts,
    usageEvents,
  );
  return { limits, tables, transactions, txSeen };
}

function createNotebookService(maxNotebooksPerUser: number): {
  limits: LimitsService;
  store: InMemoryNotebooks;
} {
  const store = new InMemoryNotebooks();
  const config = { limits: { maxNotebooksPerUser } } as AppConfigService;
  // Creating notebooks never touches the upload limit dependencies.
  const limits = new LimitsService(
    asRepositories(store).limits,
    config,
    {} as LimitTransactions,
    {} as SourceCountsRepository,
    {} as UsageEventsRepository,
  );
  return { limits, store };
}

async function fill(store: InMemoryNotebooks, userId: string, count: number): Promise<void> {
  for (let i = 0; i < count; i += 1) {
    await store.create(userId, `Notebook ${i + 1}`);
  }
}

async function uploadAndStore(fixture: UploadFixture, userId: string, notebookId: string) {
  await fixture.limits.acceptUpload(userId, notebookId);
  return fixture.tables.addSource(userId, notebookId);
}

describe('LimitsService.assertCanCreateNotebook', () => {
  it('allows a notebook below the limit', async () => {
    const { limits, store } = createNotebookService(3);
    await fill(store, USER, 2);

    await expect(limits.assertCanCreateNotebook(USER)).resolves.toBeUndefined();
  });

  it('rejects a notebook at the limit with a German message naming the limit', async () => {
    const { limits, store } = createNotebookService(3);
    await fill(store, USER, 3);

    const error = await limits.assertCanCreateNotebook(USER).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(LimitExceededError);
    expect(error).toMatchObject({ statusCode: 429, code: ErrorCode.LIMIT_EXCEEDED });
    expect((error as Error).message).toContain('höchstens 3 Notebooks');
  });

  it('counts only the notebooks of the given user', async () => {
    const { limits, store } = createNotebookService(3);
    await fill(store, OTHER_USER, 3);

    await expect(limits.assertCanCreateNotebook(USER)).resolves.toBeUndefined();
  });

  it('frees a slot when a notebook is deleted', async () => {
    const { limits, store } = createNotebookService(1);
    const notebook = await store.create(USER, 'Einziges Notebook');
    await expect(limits.assertCanCreateNotebook(USER)).rejects.toThrow(LimitExceededError);

    await store.delete(USER, notebook.id);

    await expect(limits.assertCanCreateNotebook(USER)).resolves.toBeUndefined();
  });
});

describe('LimitsService.acceptUpload', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    // 14:00 in Berlin (CEST).
    vi.setSystemTime(new Date('2026-10-21T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('accepts an upload below both limits and records it as a usage event', async () => {
    const fixture = createUploadService({ maxSourcesPerNotebook: 2, uploadsGlobalPerDay: 5 });

    await expect(fixture.limits.acceptUpload(USER, NOTEBOOK)).resolves.toBeUndefined();

    expect(fixture.tables.events).toEqual([
      { kind: 'upload', userId: USER, createdAt: new Date('2026-10-21T12:00:00.000Z') },
    ]);
  });

  it('checks and writes inside one run that holds the global upload lock', async () => {
    const fixture = createUploadService({});

    await fixture.limits.acceptUpload(USER, NOTEBOOK);

    expect(fixture.transactions.lockKeys).toEqual([[GLOBAL_UPLOAD_LOCK_KEY]]);
    expect(fixture.txSeen).toHaveLength(3);
    expect(fixture.txSeen.every((tx) => tx === fixture.transactions.tx)).toBe(true);
  });

  it('rejects the source beyond the notebook limit with a German message and records nothing', async () => {
    const fixture = createUploadService({ maxSourcesPerNotebook: 2 });
    await uploadAndStore(fixture, USER, NOTEBOOK);
    await uploadAndStore(fixture, USER, NOTEBOOK);

    const error = await fixture.limits.acceptUpload(USER, NOTEBOOK).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(LimitExceededError);
    expect(error).toMatchObject({ statusCode: 429, code: ErrorCode.LIMIT_EXCEEDED });
    expect((error as Error).message).toContain('höchstens 2 Quellen');
    expect(fixture.tables.events).toHaveLength(2);
  });

  it('counts the sources of the given notebook only', async () => {
    const fixture = createUploadService({ maxSourcesPerNotebook: 1 });
    await uploadAndStore(fixture, USER, OTHER_NOTEBOOK);

    await expect(fixture.limits.acceptUpload(USER, NOTEBOOK)).resolves.toBeUndefined();
  });

  it('frees stock when a source is deleted', async () => {
    const fixture = createUploadService({ maxSourcesPerNotebook: 1 });
    const sourceId = await uploadAndStore(fixture, USER, NOTEBOOK);
    await expect(fixture.limits.acceptUpload(USER, NOTEBOOK)).rejects.toThrow(LimitExceededError);

    fixture.tables.deleteSource(sourceId);

    await expect(fixture.limits.acceptUpload(USER, NOTEBOOK)).resolves.toBeUndefined();
  });

  it('rejects uploads beyond the global daily limit, counting all users', async () => {
    const fixture = createUploadService({ uploadsGlobalPerDay: 2 });
    await uploadAndStore(fixture, OTHER_USER, OTHER_NOTEBOOK);
    await uploadAndStore(fixture, USER, NOTEBOOK);

    const error = await fixture.limits.acceptUpload(USER, NOTEBOOK).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(LimitExceededError);
    expect(error).toMatchObject({ statusCode: 429, code: ErrorCode.LIMIT_EXCEEDED });
    expect((error as Error).message).toContain('Tageslimit von 2 Uploads');
    expect(fixture.tables.events).toHaveLength(2);
  });

  it('does not reset the daily quota when sources are deleted', async () => {
    const fixture = createUploadService({ maxSourcesPerNotebook: 20, uploadsGlobalPerDay: 2 });
    const first = await uploadAndStore(fixture, USER, NOTEBOOK);
    const second = await uploadAndStore(fixture, USER, NOTEBOOK);

    fixture.tables.deleteSource(first);
    fixture.tables.deleteSource(second);

    await expect(fixture.limits.acceptUpload(USER, NOTEBOOK)).rejects.toThrow(
      'Tageslimit von 2 Uploads',
    );
  });

  it('resets the daily quota at midnight in Berlin, not at midnight UTC', async () => {
    const fixture = createUploadService({ uploadsGlobalPerDay: 1 });
    // 23:59 in Berlin on 21 October.
    vi.setSystemTime(new Date('2026-10-21T21:59:00.000Z'));
    await uploadAndStore(fixture, USER, NOTEBOOK);
    await expect(fixture.limits.acceptUpload(USER, NOTEBOOK)).rejects.toThrow(LimitExceededError);

    // 00:00 in Berlin on 22 October, still 21 October in UTC.
    vi.setSystemTime(new Date('2026-10-21T22:00:00.000Z'));

    await expect(fixture.limits.acceptUpload(USER, NOTEBOOK)).resolves.toBeUndefined();
  });

  it('lets only one of two parallel uploads take the last daily slot', async () => {
    const fixture = createUploadService({ uploadsGlobalPerDay: 1 });

    const results = await Promise.allSettled([
      fixture.limits.acceptUpload(USER, NOTEBOOK),
      fixture.limits.acceptUpload(OTHER_USER, OTHER_NOTEBOOK),
    ]);

    expect(results.map((result) => result.status).sort()).toEqual(['fulfilled', 'rejected']);
    expect(fixture.tables.events).toHaveLength(1);
  });
});
