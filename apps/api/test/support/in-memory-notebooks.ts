import { randomUUID } from 'node:crypto';
import type { LimitsRepository } from '../../src/limits/limits.repository';
import type { NotebookRecord, NotebooksRepository } from '../../src/notebooks/notebooks.repository';

/** The public methods of a class, so a fake can implement it without its private fields. */
type PublicApi<T> = { [K in keyof T]: T[K] };

interface StoredNotebook extends NotebookRecord {
  userId: string;
}

const START = Date.parse('2026-10-01T08:00:00.000Z');

/**
 * In-memory stand-in for the notebook and limit repositories. It honours the
 * same contract as the Drizzle versions: every method filters by `userId`, and
 * another user's notebook behaves like a missing one. A ticking clock gives
 * every write a distinct timestamp, so ordering is deterministic.
 */
export class InMemoryNotebooks
  implements PublicApi<NotebooksRepository>, PublicApi<LimitsRepository>
{
  private readonly rows: StoredNotebook[] = [];
  private tick = 0;

  list(userId: string): Promise<NotebookRecord[]> {
    const own = this.rows
      .filter((row) => row.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return Promise.resolve(own.map(toRecord));
  }

  findById(userId: string, id: string): Promise<NotebookRecord | undefined> {
    const row = this.find(userId, id);
    return Promise.resolve(row && toRecord(row));
  }

  create(userId: string, title: string): Promise<NotebookRecord> {
    const now = this.now();
    const row: StoredNotebook = {
      id: randomUUID(),
      userId,
      title,
      createdAt: now,
      updatedAt: now,
      sourceCount: 0,
    };
    this.rows.push(row);
    return Promise.resolve(toRecord(row));
  }

  rename(userId: string, id: string, title: string): Promise<NotebookRecord | undefined> {
    const row = this.find(userId, id);
    if (row) {
      row.title = title;
      row.updatedAt = this.now();
    }
    return Promise.resolve(row && toRecord(row));
  }

  delete(userId: string, id: string): Promise<boolean> {
    const index = this.rows.findIndex((row) => row.userId === userId && row.id === id);
    if (index >= 0) {
      this.rows.splice(index, 1);
    }
    return Promise.resolve(index >= 0);
  }

  countNotebooks(userId: string): Promise<number> {
    return Promise.resolve(this.rows.filter((row) => row.userId === userId).length);
  }

  private find(userId: string, id: string): StoredNotebook | undefined {
    return this.rows.find((row) => row.userId === userId && row.id === id);
  }

  private now(): Date {
    this.tick += 1;
    return new Date(START + this.tick * 1000);
  }
}

/**
 * The fake typed as the real repositories for constructor injection. The Drizzle
 * classes carry a private `db`, so TypeScript needs the cast; callers only use
 * the public methods, which `implements` above checks.
 */
export function asRepositories(store: InMemoryNotebooks): {
  notebooks: NotebooksRepository;
  limits: LimitsRepository;
} {
  return {
    notebooks: store as unknown as NotebooksRepository,
    limits: store as unknown as LimitsRepository,
  };
}

// A copy, so callers cannot change the store through a returned object.
function toRecord(row: StoredNotebook): NotebookRecord {
  const { id, title, createdAt, updatedAt, sourceCount } = row;
  return { id, title, createdAt, updatedAt, sourceCount };
}
