import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, type SQL } from 'drizzle-orm';
import { type Database, DRIZZLE } from '../db/db.module';
import { notebooks, sources } from '../db/schema';

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

/**
 * All notebook queries. Every method takes the signed-in user's ID and filters
 * by it, so tenant isolation is enforced in this one place (apps/api/CLAUDE.md
 * "Struktur"). A notebook of another user behaves exactly like a missing one.
 */
@Injectable()
export class NotebooksRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  list(userId: string): Promise<NotebookRecord[]> {
    return this.db
      .select(this.columnsWithSourceCount())
      .from(notebooks)
      .where(eq(notebooks.userId, userId))
      .orderBy(desc(notebooks.createdAt), desc(notebooks.id));
  }

  async findById(userId: string, id: string): Promise<NotebookRecord | undefined> {
    const [row] = await this.db
      .select(this.columnsWithSourceCount())
      .from(notebooks)
      .where(ownedBy(userId, id));
    return row;
  }

  async create(userId: string, title: string): Promise<NotebookRecord> {
    const [row] = await this.db.insert(notebooks).values({ userId, title }).returning(columns);
    if (!row) {
      throw new Error('Insert into notebooks returned no row');
    }
    // A new notebook has no sources yet.
    return { ...row, sourceCount: 0 };
  }

  /** `updated_at` is set by the schema's `$onUpdate`. */
  async rename(userId: string, id: string, title: string): Promise<NotebookRecord | undefined> {
    const [row] = await this.db
      .update(notebooks)
      .set({ title })
      .where(ownedBy(userId, id))
      .returning(columns);
    return row && { ...row, sourceCount: await this.countSources(userId, id) };
  }

  /** Returns whether a notebook was deleted. Rows that depend on it follow by cascade. */
  async delete(userId: string, id: string): Promise<boolean> {
    const rows = await this.db
      .delete(notebooks)
      .where(ownedBy(userId, id))
      .returning({ id: notebooks.id });
    return rows.length > 0;
  }

  /**
   * The notebook columns plus a correlated count of its sources, so a list
   * takes one query instead of one per notebook. The count filters by the
   * owner as well, like every source query.
   */
  private columnsWithSourceCount() {
    return {
      ...columns,
      sourceCount: this.db.$count(
        sources,
        and(eq(sources.notebookId, notebooks.id), eq(sources.userId, notebooks.userId)),
      ),
    };
  }

  private countSources(userId: string, id: string): Promise<number> {
    return this.db.$count(sources, and(eq(sources.notebookId, id), eq(sources.userId, userId)));
  }
}

function ownedBy(userId: string, id: string): SQL | undefined {
  return and(eq(notebooks.id, id), eq(notebooks.userId, userId));
}
