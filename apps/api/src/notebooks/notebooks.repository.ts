import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, type SQL } from 'drizzle-orm';
import { type Database, DRIZZLE } from '../db/db.module';
import { notebooks } from '../db/schema';

/** A notebook as the service sees it: without the owner, plus its number of sources. */
export interface NotebookRecord {
  id: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
  sourceCount: number;
}

// The owner is a filter, never part of a result.
const columns = {
  id: notebooks.id,
  title: notebooks.title,
  createdAt: notebooks.createdAt,
  updatedAt: notebooks.updatedAt,
};

type NotebookColumns = Omit<NotebookRecord, 'sourceCount'>;

/**
 * All notebook queries. Every method takes the signed-in user's ID and filters
 * by it, so tenant isolation is enforced in this one place (apps/api/CLAUDE.md
 * "Struktur"). A notebook of another user behaves exactly like a missing one.
 */
@Injectable()
export class NotebooksRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async list(userId: string): Promise<NotebookRecord[]> {
    const rows = await this.db
      .select(columns)
      .from(notebooks)
      .where(eq(notebooks.userId, userId))
      .orderBy(desc(notebooks.createdAt), desc(notebooks.id));
    return rows.map(withSourceCount);
  }

  async findById(userId: string, id: string): Promise<NotebookRecord | undefined> {
    const [row] = await this.db.select(columns).from(notebooks).where(ownedBy(userId, id));
    return row && withSourceCount(row);
  }

  async create(userId: string, title: string): Promise<NotebookRecord> {
    const [row] = await this.db.insert(notebooks).values({ userId, title }).returning(columns);
    if (!row) {
      throw new Error('Insert into notebooks returned no row');
    }
    return withSourceCount(row);
  }

  /** `updated_at` is set by the schema's `$onUpdate`. */
  async rename(userId: string, id: string, title: string): Promise<NotebookRecord | undefined> {
    const [row] = await this.db
      .update(notebooks)
      .set({ title })
      .where(ownedBy(userId, id))
      .returning(columns);
    return row && withSourceCount(row);
  }

  /** Returns whether a notebook was deleted. Rows that depend on it follow by cascade. */
  async delete(userId: string, id: string): Promise<boolean> {
    const rows = await this.db
      .delete(notebooks)
      .where(ownedBy(userId, id))
      .returning({ id: notebooks.id });
    return rows.length > 0;
  }
}

function ownedBy(userId: string, id: string): SQL | undefined {
  return and(eq(notebooks.id, id), eq(notebooks.userId, userId));
}

// The `sources` table arrives in M2 together with the real count. Until then
// no notebook can have sources.
function withSourceCount(row: NotebookColumns): NotebookRecord {
  return { ...row, sourceCount: 0 };
}
