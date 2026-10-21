import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, type SQL } from 'drizzle-orm';
import { type Database, DRIZZLE } from '../db/db.module';
import { notebooks, type SourceRow, sources } from '../db/schema';

/** A source as the service sees it: without the owner and the storage path. */
export type SourceRecord = Pick<
  SourceRow,
  'id' | 'notebookId' | 'type' | 'title' | 'status' | 'error' | 'isActive' | 'createdAt'
>;

/** The values a new source row is written with; status and flags take their defaults. */
export type NewSourceRecord = Pick<
  SourceRow,
  'id' | 'notebookId' | 'userId' | 'type' | 'title' | 'storagePath'
>;

// The owner is a filter, never part of a result.
const columns = {
  id: sources.id,
  notebookId: sources.notebookId,
  type: sources.type,
  title: sources.title,
  status: sources.status,
  error: sources.error,
  isActive: sources.isActive,
  createdAt: sources.createdAt,
};

/**
 * All source queries. Every method takes the signed-in user's ID and the
 * notebook ID and filters by both, so a source is only ever reached through
 * its own notebook (PE-07) and tenant isolation is enforced in this one place
 * (apps/api/CLAUDE.md "Struktur"). Another user's source behaves exactly like
 * a missing one.
 */
@Injectable()
export class SourcesRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  /** Whether the notebook exists and belongs to the user: the ownership check before any source action. */
  async notebookExists(userId: string, notebookId: string): Promise<boolean> {
    const [row] = await this.db
      .select({ id: notebooks.id })
      .from(notebooks)
      .where(and(eq(notebooks.id, notebookId), eq(notebooks.userId, userId)));
    return row !== undefined;
  }

  list(userId: string, notebookId: string): Promise<SourceRecord[]> {
    return this.db
      .select(columns)
      .from(sources)
      .where(and(eq(sources.userId, userId), eq(sources.notebookId, notebookId)))
      .orderBy(desc(sources.createdAt), desc(sources.id));
  }

  /** The IDs of all sources of a notebook, e.g. to remove their files before the notebook goes. */
  async listIds(userId: string, notebookId: string): Promise<string[]> {
    const rows = await this.db
      .select({ id: sources.id })
      .from(sources)
      .where(and(eq(sources.userId, userId), eq(sources.notebookId, notebookId)));
    return rows.map((row) => row.id);
  }

  async findById(
    userId: string,
    notebookId: string,
    sourceId: string,
  ): Promise<SourceRecord | undefined> {
    const [row] = await this.db
      .select(columns)
      .from(sources)
      .where(ownedBy(userId, notebookId, sourceId));
    return row;
  }

  async create(values: NewSourceRecord): Promise<SourceRecord> {
    const [row] = await this.db.insert(sources).values(values).returning(columns);
    if (!row) {
      throw new Error('Insert into sources returned no row');
    }
    return row;
  }

  async setActive(
    userId: string,
    notebookId: string,
    sourceId: string,
    isActive: boolean,
  ): Promise<SourceRecord | undefined> {
    const [row] = await this.db
      .update(sources)
      .set({ isActive })
      .where(ownedBy(userId, notebookId, sourceId))
      .returning(columns);
    return row;
  }

  /** Returns whether a source was deleted. Rows that depend on it follow by cascade. */
  async delete(userId: string, notebookId: string, sourceId: string): Promise<boolean> {
    const rows = await this.db
      .delete(sources)
      .where(ownedBy(userId, notebookId, sourceId))
      .returning({ id: sources.id });
    return rows.length > 0;
  }
}

function ownedBy(userId: string, notebookId: string, sourceId: string): SQL | undefined {
  return and(
    eq(sources.id, sourceId),
    eq(sources.notebookId, notebookId),
    eq(sources.userId, userId),
  );
}
