import { Inject, Injectable } from '@nestjs/common';
import { and, asc, cosineDistance, eq, type SQL } from 'drizzle-orm';
import { type Database, DRIZZLE } from '../db/db.module';
import { chunks, type ChunkRow, sources } from '../db/schema';

/** A chunk found by the vector search, with what the prompt and the citations need. */
export interface RetrievedChunk {
  chunkId: string;
  sourceId: string;
  sourceTitle: string;
  page: ChunkRow['page'];
  content: string;
}

/**
 * Data access of the retrieval. Both methods take the signed-in user's ID and
 * the notebook ID and filter by both, so another user's notebook behaves
 * exactly like an empty one (apps/api/CLAUDE.md "Struktur").
 */
@Injectable()
export class RetrievalRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  /**
   * The `k` chunks closest to `embedding` by cosine distance, nearest first.
   * The search is exact: without a vector index Postgres compares every chunk
   * of the notebook, which is fast at the notebook limits and always returns
   * the true top k (CLAUDE.md section 9). The chunk ID breaks ties, so equal
   * distances give a stable order.
   */
  search(
    userId: string,
    notebookId: string,
    embedding: readonly number[],
    k: number,
  ): Promise<RetrievedChunk[]> {
    return this.db
      .select({
        chunkId: chunks.id,
        sourceId: chunks.sourceId,
        sourceTitle: sources.title,
        page: chunks.page,
        content: chunks.content,
      })
      .from(chunks)
      .innerJoin(sources, eq(sources.id, chunks.sourceId))
      .where(
        and(
          eq(chunks.userId, userId),
          eq(chunks.notebookId, notebookId),
          usableSources(userId, notebookId),
        ),
      )
      .orderBy(cosineDistance(chunks.embedding, [...embedding]), asc(chunks.id))
      .limit(k);
  }

  /** Whether the notebook has at least one active source with status `ready`. */
  async hasReadyActiveSources(userId: string, notebookId: string): Promise<boolean> {
    const [row] = await this.db
      .select({ id: sources.id })
      .from(sources)
      .where(usableSources(userId, notebookId))
      .limit(1);
    return row !== undefined;
  }
}

/**
 * The sources the chat may use: the user's own, in this notebook, switched on
 * and fully processed. Chunks of a source still being re-ingested or switched
 * off must never reach the prompt.
 */
function usableSources(userId: string, notebookId: string): SQL | undefined {
  return and(
    eq(sources.userId, userId),
    eq(sources.notebookId, notebookId),
    eq(sources.isActive, true),
    eq(sources.status, 'ready'),
  );
}
