import type { SourceStatus, SourceType } from '@notebooklm/shared';
import type {
  EmbeddedChunk,
  IngestionRepository,
  IngestionSource,
} from '../../src/ingestion/ingestion.repository';

/** The public methods of a class, so a fake can implement it without its private fields. */
type PublicApi<T> = { [K in keyof T]: T[K] };

export interface IngestionSourceRow extends IngestionSource {
  userId: string;
  status: SourceStatus;
  error: string | null;
}

export interface StoredChunk extends EmbeddedChunk {
  sourceId: string;
  notebookId: string;
  userId: string;
}

/**
 * In-memory stand-in for `IngestionRepository`, with the same contract: every
 * method filters by user, a source of another user behaves like a missing one,
 * and `replaceChunks` writes all or nothing. Deleting a source removes its
 * chunks, like the foreign key cascade.
 */
export class InMemoryIngestion implements PublicApi<IngestionRepository> {
  readonly sources: IngestionSourceRow[] = [];
  chunks: StoredChunk[] = [];
  /** Runs at the start of `replaceChunks`, e.g. to delete the source in the middle of a job. */
  beforeReplace: (() => void) | undefined;

  addSource(source: { id: string; userId: string; notebookId: string; type: SourceType }): void {
    this.sources.push({ ...source, status: 'pending', error: null });
  }

  /** Removes a source and its chunks, like `DELETE FROM sources` with its cascade. */
  deleteSource(sourceId: string): void {
    const index = this.sources.findIndex((row) => row.id === sourceId);
    if (index >= 0) {
      this.sources.splice(index, 1);
    }
    this.chunks = this.chunks.filter((chunk) => chunk.sourceId !== sourceId);
  }

  source(sourceId: string): IngestionSourceRow | undefined {
    return this.sources.find((row) => row.id === sourceId);
  }

  findSource(userId: string, sourceId: string): Promise<IngestionSource | undefined> {
    const row = this.owned(userId, sourceId);
    return Promise.resolve(row && toSource(row));
  }

  markProcessing(userId: string, sourceId: string): Promise<IngestionSource | undefined> {
    const row = this.owned(userId, sourceId);
    if (row) {
      row.status = 'processing';
      row.error = null;
    }
    return Promise.resolve(row && toSource(row));
  }

  markFailed(userId: string, sourceId: string, message: string): Promise<boolean> {
    const row = this.owned(userId, sourceId);
    if (row) {
      row.status = 'failed';
      row.error = message;
    }
    return Promise.resolve(row !== undefined);
  }

  replaceChunks(
    userId: string,
    source: IngestionSource,
    embedded: readonly EmbeddedChunk[],
  ): Promise<boolean> {
    this.beforeReplace?.();
    const row = this.owned(userId, source.id);
    if (!row) {
      return Promise.resolve(false);
    }
    this.chunks = [
      ...this.chunks.filter((chunk) => !(chunk.sourceId === source.id && chunk.userId === userId)),
      ...embedded.map((chunk) => ({
        ...chunk,
        sourceId: source.id,
        notebookId: source.notebookId,
        userId,
      })),
    ];
    row.status = 'ready';
    row.error = null;
    return Promise.resolve(true);
  }

  private owned(userId: string, sourceId: string): IngestionSourceRow | undefined {
    return this.sources.find((row) => row.id === sourceId && row.userId === userId);
  }
}

function toSource(row: IngestionSourceRow): IngestionSource {
  return { id: row.id, notebookId: row.notebookId, type: row.type };
}
