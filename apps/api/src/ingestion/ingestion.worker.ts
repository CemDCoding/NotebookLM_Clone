import { Inject, Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { EMBEDDING_PROVIDER, type EmbeddingProvider } from '../llm/embedding.provider';
import { INGEST_RETRY_LIMIT, INGEST_SOURCE_QUEUE, type IngestSourceJob } from '../queue/queue.jobs';
import { type QueueJob, QueueService } from '../queue/queue.service';
import { StorageService } from '../storage/storage.service';
import { chunkPages } from './chunking';
import { extractPages, IngestionError, NO_READABLE_TEXT_MESSAGE } from './extraction';
import { IngestionRepository, type IngestionSource } from './ingestion.repository';

/** Jobs one instance processes at the same time (PE-14), gentle on the embedding rate limit. */
export const INGESTION_CONCURRENCY = 2;

/**
 * Shown when a source still fails after every retry. The cause is technical
 * (provider, storage, database) and its message may contain internals, so the
 * user gets a generic text; the UI adds the hint to delete and re-upload.
 */
export const INGESTION_FAILED_MESSAGE = 'Die Quelle konnte nicht verarbeitet werden.';

/** The parts of a pg-boss job the worker reads. */
export type IngestionJob = Pick<QueueJob<IngestSourceJob>, 'id' | 'data' | 'retryCount' | 'signal'>;

/**
 * pg-boss handler that turns a stored source into embedded chunks
 * (apps/api/CLAUDE.md "sources und ingestion"): `processing`, then extract,
 * chunk, embed and store, then `ready`. A content problem (`IngestionError`)
 * fails the source at once; any other error is thrown so pg-boss retries, and
 * after the last retry the source fails with a generic message. A source
 * deleted before or during the run ends the job silently.
 *
 * Logs carry only IDs, counts, durations and error classes, never messages or
 * content (CLAUDE.md section 7, DSGVO).
 */
@Injectable()
export class IngestionWorker implements OnApplicationBootstrap {
  private readonly logger = new Logger(IngestionWorker.name);

  constructor(
    @Inject(IngestionRepository) private readonly repository: IngestionRepository,
    @Inject(StorageService) private readonly storage: StorageService,
    @Inject(EMBEDDING_PROVIDER) private readonly embeddings: EmbeddingProvider,
    @Inject(QueueService) private readonly queue: QueueService,
  ) {}

  // After every `onModuleInit`, so pg-boss has started.
  async onApplicationBootstrap(): Promise<void> {
    await this.queue.work<IngestSourceJob>(INGEST_SOURCE_QUEUE, (job) => this.process(job), {
      concurrency: INGESTION_CONCURRENCY,
    });
  }

  async process(job: IngestionJob): Promise<void> {
    const startedAt = Date.now();
    const { sourceId, userId } = job.data;
    const context = { sourceId, jobId: job.id };
    const durationMs = () => Date.now() - startedAt;

    const source = await this.repository.markProcessing(userId, sourceId);
    if (!source) {
      this.logger.log({ message: 'Ingestion skipped, source deleted', ...context });
      return;
    }

    try {
      const chunkCount = await this.ingest(userId, source, job.signal);
      if (chunkCount === undefined) {
        this.logger.log({ message: 'Ingestion skipped, source deleted', ...context });
        return;
      }
      this.logger.log({
        message: 'Ingestion completed',
        ...context,
        durationMs: durationMs(),
        chunkCount,
      });
    } catch (error) {
      await this.handleFailure(job, error, durationMs());
    }
  }

  /** Returns the number of stored chunks, or `undefined` if the source was deleted meanwhile. */
  private async ingest(
    userId: string,
    source: IngestionSource,
    signal: AbortSignal,
  ): Promise<number | undefined> {
    const content = await this.storage.download(userId, source.id);
    const textChunks = chunkPages(await extractPages(content, source.type));
    // Text made only of invisible characters passes extraction but normalizes
    // to nothing. A source without chunks could never be cited, so it must
    // fail instead of turning `ready` without content.
    if (textChunks.length === 0) {
      throw new IngestionError(NO_READABLE_TEXT_MESSAGE);
    }
    const vectors = await this.embeddings.embed(
      textChunks.map((chunk) => chunk.content),
      signal,
    );
    const embedded = textChunks.map((chunk, index) => ({
      ...chunk,
      embedding: vectorAt(vectors, index),
    }));
    const stored = await this.repository.replaceChunks(userId, source, embedded);
    return stored ? embedded.length : undefined;
  }

  private async handleFailure(
    job: IngestionJob,
    error: unknown,
    durationMs: number,
  ): Promise<void> {
    const { sourceId, userId } = job.data;
    const context = { sourceId, jobId: job.id, durationMs, errorClass: errorClassOf(error) };

    if (error instanceof IngestionError) {
      // Permanent: retrying the same file gives the same result.
      await this.repository.markFailed(userId, sourceId, error.message);
      this.logger.warn({ message: 'Ingestion failed permanently', ...context });
      return;
    }

    // A source deleted mid-run shows up as an arbitrary error, e.g. a missing
    // storage file or a foreign key violation. That is not a failure.
    if (!(await this.repository.findSource(userId, sourceId))) {
      this.logger.log({ message: 'Ingestion skipped, source deleted', ...context });
      return;
    }

    if (job.retryCount >= INGEST_RETRY_LIMIT) {
      await this.repository.markFailed(userId, sourceId, INGESTION_FAILED_MESSAGE);
      this.logger.error({ message: 'Ingestion failed after last retry', ...context });
    } else {
      // The source stays `processing`, so the UI keeps waiting for the retry.
      this.logger.warn({ message: 'Ingestion attempt failed, will retry', ...context });
    }
    // Thrown in both cases: pg-boss retries the job or records it as failed.
    throw error;
  }
}

function vectorAt(vectors: readonly number[][], index: number): number[] {
  const vector = vectors[index];
  if (!vector) {
    // The provider promises one vector per text; storing a chunk without one
    // would break retrieval, so a broken promise must not pass silently.
    throw new Error(`Embedding provider returned no vector for chunk ${index}`);
  }
  return vector;
}

function errorClassOf(error: unknown): string {
  return error instanceof Error ? error.constructor.name : typeof error;
}
