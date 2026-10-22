import { Inject, Injectable } from '@nestjs/common';
import { and, eq, type SQL } from 'drizzle-orm';
import { type Database, DRIZZLE } from '../db/db.module';
import { chunks, type SourceRow, sources } from '../db/schema';

/** What the worker needs to know about a source before processing it. */
export type IngestionSource = Pick<SourceRow, 'id' | 'notebookId' | 'type'>;

/** A chunk ready to be stored: its text, position and embedding. */
export interface EmbeddedChunk {
  content: string;
  page: number | null;
  position: number;
  embedding: number[];
}

const sourceColumns = { id: sources.id, notebookId: sources.notebookId, type: sources.type };

// One statement per batch keeps every insert far below Postgres' limit of
// 65,535 parameters and its statement size small, even for a source with
// thousands of chunks (each vector alone is 1,024 numbers).
const INSERT_BATCH_SIZE = 100;

/**
 * All database access of the ingestion worker. Every method takes the user ID
 * from the job payload and filters by it, like every other repository
 * (apps/api/CLAUDE.md "Struktur"). The worker has no request context, so the
 * payload is the only source of the owner; a source of another user behaves
 * exactly like a deleted one.
 */
@Injectable()
export class IngestionRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async findSource(userId: string, sourceId: string): Promise<IngestionSource | undefined> {
    const [row] = await this.db
      .select(sourceColumns)
      .from(sources)
      .where(ownedBy(userId, sourceId));
    return row;
  }

  /**
   * Marks the source as `processing` and returns it, or `undefined` if it no
   * longer exists. A retry clears the error of an earlier attempt.
   */
  async markProcessing(userId: string, sourceId: string): Promise<IngestionSource | undefined> {
    const [row] = await this.db
      .update(sources)
      .set({ status: 'processing', error: null })
      .where(ownedBy(userId, sourceId))
      .returning(sourceColumns);
    return row;
  }

  /** Returns whether the source still exists. `message` is shown in the UI. */
  async markFailed(userId: string, sourceId: string, message: string): Promise<boolean> {
    const rows = await this.db
      .update(sources)
      .set({ status: 'failed', error: message })
      .where(ownedBy(userId, sourceId))
      .returning({ id: sources.id });
    return rows.length > 0;
  }

  /**
   * Replaces all chunks of a source and marks it `ready`, in one transaction
   * (apps/api/CLAUDE.md "sources und ingestion", step 4). A second run of the
   * same job therefore never leaves duplicate chunks, and a failed write
   * leaves the previous state untouched.
   *
   * Returns `false` without writing anything if the source no longer exists.
   */
  async replaceChunks(
    userId: string,
    source: IngestionSource,
    embedded: readonly EmbeddedChunk[],
  ): Promise<boolean> {
    return this.db.transaction(async (tx) => {
      // The status goes first although it is the last step logically: the
      // update locks the source row, so a parallel delete waits for this
      // transaction instead of removing the source between the checks, and a
      // source deleted earlier is noticed before any chunk is written. The
      // commit makes all three writes visible at once.
      const updated = await tx
        .update(sources)
        .set({ status: 'ready', error: null })
        .where(ownedBy(userId, source.id))
        .returning({ id: sources.id });
      if (updated.length === 0) {
        return false;
      }

      await tx.delete(chunks).where(and(eq(chunks.sourceId, source.id), eq(chunks.userId, userId)));

      const rows = embedded.map((chunk) => ({
        sourceId: source.id,
        notebookId: source.notebookId,
        userId,
        content: chunk.content,
        embedding: chunk.embedding,
        page: chunk.page,
        position: chunk.position,
      }));
      for (let start = 0; start < rows.length; start += INSERT_BATCH_SIZE) {
        await tx.insert(chunks).values(rows.slice(start, start + INSERT_BATCH_SIZE));
      }
      return true;
    });
  }
}

function ownedBy(userId: string, sourceId: string): SQL | undefined {
  return and(eq(sources.id, sourceId), eq(sources.userId, userId));
}
