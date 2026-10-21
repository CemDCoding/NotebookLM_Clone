import { DEFAULT_LIMITS, type Limits } from '@notebooklm/shared';
import type { AppConfigService } from '../../src/config';
import type { LimitTransaction, LimitTransactions } from '../../src/limits/limit-transactions';
import type { LimitsRepository } from '../../src/limits/limits.repository';
import { LimitsService } from '../../src/limits/limits.service';
import type { SourceCountsRepository } from '../../src/limits/source-counts.repository';
import type {
  UsageEventKind,
  UsageEventsRepository,
} from '../../src/limits/usage-events.repository';
import type {
  NewSourceRecord,
  SourceRecord,
  SourcesRepository,
} from '../../src/sources/sources.repository';
import { sourceObjectPath, type StorageService } from '../../src/storage/storage.service';

/** The public methods of a class, so a fake can implement it without its private fields. */
type PublicApi<T> = { [K in keyof T]: T[K] };

interface StoredSource extends SourceRecord {
  userId: string;
  storagePath: string | null;
}

const START = Date.parse('2026-10-01T08:00:00.000Z');

/**
 * One log of all writes to storage and database, in the order they happened,
 * so tests can check e.g. that a file is removed before its row (PE-22).
 */
export type CallLog = string[];

/**
 * In-memory stand-in for `SourcesRepository`, with the same contract: every
 * method filters by user and notebook, and another user's notebook or source
 * behaves like a missing one. Notebooks are only registered as owner pairs.
 */
export class InMemorySources implements PublicApi<SourcesRepository> {
  readonly rows: StoredSource[] = [];
  private readonly notebooks = new Set<string>();
  private tick = 0;
  /** Makes the next `create` fail, like a foreign key violation after a parallel notebook delete. */
  failNextCreate = false;

  /**
   * @param ownsNotebook answers the ownership check from another store, e.g.
   *   the in-memory notebooks of an HTTP test. Without it, notebooks are
   *   registered with `addNotebook`.
   */
  constructor(
    private readonly calls: CallLog = [],
    private readonly ownsNotebook?: (userId: string, notebookId: string) => Promise<boolean>,
  ) {}

  addNotebook(userId: string, notebookId: string): void {
    this.notebooks.add(notebookKey(userId, notebookId));
  }

  notebookExists(userId: string, notebookId: string): Promise<boolean> {
    if (this.ownsNotebook) {
      return this.ownsNotebook(userId, notebookId);
    }
    return Promise.resolve(this.notebooks.has(notebookKey(userId, notebookId)));
  }

  list(userId: string, notebookId: string): Promise<SourceRecord[]> {
    const own = this.rows
      .filter((row) => row.userId === userId && row.notebookId === notebookId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return Promise.resolve(own.map(toRecord));
  }

  listIds(userId: string, notebookId: string): Promise<string[]> {
    return Promise.resolve(
      this.rows
        .filter((row) => row.userId === userId && row.notebookId === notebookId)
        .map((row) => row.id),
    );
  }

  findById(
    userId: string,
    notebookId: string,
    sourceId: string,
  ): Promise<SourceRecord | undefined> {
    const row = this.find(userId, notebookId, sourceId);
    return Promise.resolve(row && toRecord(row));
  }

  create(values: NewSourceRecord): Promise<SourceRecord> {
    this.calls.push(`db:create:${values.id}`);
    if (this.failNextCreate) {
      this.failNextCreate = false;
      return Promise.reject(new Error('insert or update on table "sources" violates foreign key'));
    }
    this.tick += 1;
    const row: StoredSource = {
      ...values,
      status: 'pending',
      error: null,
      isActive: true,
      createdAt: new Date(START + this.tick * 1000),
    };
    this.rows.push(row);
    return Promise.resolve(toRecord(row));
  }

  setActive(
    userId: string,
    notebookId: string,
    sourceId: string,
    isActive: boolean,
  ): Promise<SourceRecord | undefined> {
    const row = this.find(userId, notebookId, sourceId);
    if (row) {
      row.isActive = isActive;
    }
    return Promise.resolve(row && toRecord(row));
  }

  delete(userId: string, notebookId: string, sourceId: string): Promise<boolean> {
    this.calls.push(`db:delete:${sourceId}`);
    const index = this.rows.findIndex(
      (row) => row.userId === userId && row.notebookId === notebookId && row.id === sourceId,
    );
    if (index >= 0) {
      this.rows.splice(index, 1);
    }
    return Promise.resolve(index >= 0);
  }

  countSources(userId: string, notebookId: string): number {
    return this.rows.filter((row) => row.userId === userId && row.notebookId === notebookId).length;
  }

  private find(userId: string, notebookId: string, sourceId: string): StoredSource | undefined {
    return this.rows.find(
      (row) => row.userId === userId && row.notebookId === notebookId && row.id === sourceId,
    );
  }
}

export interface StoredFile {
  content: Buffer;
  contentType: string;
}

/** In-memory bucket keyed by the real path scheme `{userId}/{sourceId}`. */
export class FakeStorage implements PublicApi<StorageService> {
  readonly files = new Map<string, StoredFile>();
  /** Makes every `remove` fail until reset, like an unreachable storage service. */
  failRemove = false;

  constructor(private readonly calls: CallLog = []) {}

  upload(userId: string, sourceId: string, content: Buffer, contentType: string): Promise<void> {
    this.calls.push(`storage:upload:${sourceId}`);
    this.files.set(sourceObjectPath(userId, sourceId), { content, contentType });
    return Promise.resolve();
  }

  download(userId: string, sourceId: string): Promise<Buffer> {
    const file = this.files.get(sourceObjectPath(userId, sourceId));
    return file ? Promise.resolve(file.content) : Promise.reject(new Error('Object not found'));
  }

  remove(userId: string, sourceIds: readonly string[]): Promise<void> {
    this.calls.push(`storage:remove:${sourceIds.join(',')}`);
    if (this.failRemove) {
      return Promise.reject(new Error('Storage unavailable'));
    }
    for (const sourceId of sourceIds) {
      this.files.delete(sourceObjectPath(userId, sourceId));
    }
    return Promise.resolve();
  }

  removeAllForUser(userId: string): Promise<void> {
    for (const path of this.files.keys()) {
      if (path.startsWith(`${userId}/`)) {
        this.files.delete(path);
      }
    }
    return Promise.resolve();
  }
}

export interface UploadLimitTables {
  transactions: LimitTransactions;
  sourceCounts: SourceCountsRepository;
  usageEvents: UsageEventsRepository;
  /** Number of `upload` usage events written so far. */
  uploadEvents: () => number;
}

/**
 * The tables behind the upload limits: source counts come from the in-memory
 * sources, usage events from an in-memory log. Usage events have no link to
 * sources, so deleting a source leaves them in place, as in the database.
 * Every event counts as today's.
 */
export function uploadLimitTables(sources: InMemorySources): UploadLimitTables {
  const events: { kind: UsageEventKind; userId: string }[] = [];
  const tx = { fake: 'transaction' } as unknown as LimitTransaction;
  const transactions: Pick<LimitTransactions, 'run'> = {
    run: (_lockKeys, work) => work(tx),
  };
  const sourceCounts: PublicApi<SourceCountsRepository> = {
    countSources: (_tx, userId, notebookId) =>
      Promise.resolve(sources.countSources(userId, notebookId)),
  };
  const usageEvents: PublicApi<UsageEventsRepository> = {
    countSince: (_tx, kind) =>
      Promise.resolve(events.filter((event) => event.kind === kind).length),
    insert: (_tx, kind, userId) => {
      events.push({ kind, userId });
      return Promise.resolve();
    },
  };
  return {
    transactions: transactions as LimitTransactions,
    sourceCounts: sourceCounts as SourceCountsRepository,
    usageEvents: usageEvents as UsageEventsRepository,
    uploadEvents: () => events.filter((event) => event.kind === 'upload').length,
  };
}

/** The real `LimitsService` on top of `uploadLimitTables`. */
export function createUploadLimits(
  sources: InMemorySources,
  overrides: Partial<Limits> = {},
): { limits: LimitsService; uploadEvents: () => number } {
  const tables = uploadLimitTables(sources);
  const config = { limits: { ...DEFAULT_LIMITS, ...overrides } } as AppConfigService;
  const limits = new LimitsService(
    {} as LimitsRepository,
    config,
    tables.transactions,
    tables.sourceCounts,
    tables.usageEvents,
  );
  return { limits, uploadEvents: tables.uploadEvents };
}

function notebookKey(userId: string, notebookId: string): string {
  return `${userId}/${notebookId}`;
}

// A copy without owner and path, so callers cannot change the store through a returned object.
function toRecord(row: StoredSource): SourceRecord {
  const { id, notebookId, type, title, status, error, isActive, createdAt } = row;
  return { id, notebookId, type, title, status, error, isActive, createdAt };
}
