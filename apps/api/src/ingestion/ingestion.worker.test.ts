import { randomUUID } from 'node:crypto';
import { Logger } from '@nestjs/common';
import type { SourceType } from '@notebooklm/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FakeQueue } from '../../test/support/fake-queue';
import { InMemoryIngestion } from '../../test/support/in-memory-ingestion';
import { FakeStorage } from '../../test/support/in-memory-sources';
import { miniPdf } from '../../test/support/mini-pdf';
import { EMBEDDING_DIMENSIONS } from '../db/schema';
import type { EmbeddingProvider } from '../llm/embedding.provider';
import { INGEST_RETRY_LIMIT, INGEST_SOURCE_QUEUE } from '../queue/queue.jobs';
import type { QueueService } from '../queue/queue.service';
import type { StorageService } from '../storage/storage.service';
import { CHUNK_SIZE } from './chunking';
import { extractPages, NO_READABLE_TEXT_MESSAGE } from './extraction';
import type { IngestionRepository } from './ingestion.repository';
import {
  INGESTION_CONCURRENCY,
  INGESTION_FAILED_MESSAGE,
  type IngestionJob,
  IngestionWorker,
} from './ingestion.worker';

const USER_ID = randomUUID();
const OTHER_USER_ID = randomUUID();
const NOTEBOOK_ID = randomUUID();
// Zero-width space, soft hyphen and word joiner: no visible text at all.
const INVISIBLE_ONLY = '\u200B\u00AD\u2060';

// The only fields a worker log may carry (CLAUDE.md section 7, DSGVO).
const ALLOWED_LOG_FIELDS = new Set([
  'message',
  'sourceId',
  'jobId',
  'durationMs',
  'chunkCount',
  'errorClass',
]);

/** Returns a distinct vector per text, so a test can tell which chunk got which vector. */
class FakeEmbeddings implements EmbeddingProvider {
  readonly calls: { texts: readonly string[]; signal: AbortSignal | undefined }[] = [];
  failWith: Error | undefined;
  /** Drops the last vector, like a provider breaking its promise of one vector per text. */
  dropLast = false;

  embed(texts: readonly string[], signal?: AbortSignal): Promise<number[][]> {
    this.calls.push({ texts, signal });
    if (this.failWith) {
      return Promise.reject(this.failWith);
    }
    const vectors = texts.map((_, index) => vectorFor(index));
    return Promise.resolve(this.dropLast ? vectors.slice(0, -1) : vectors);
  }
}

function vectorFor(index: number): number[] {
  return Array.from({ length: EMBEDDING_DIMENSIONS }, () => index);
}

interface Setup {
  worker: IngestionWorker;
  repository: InMemoryIngestion;
  storage: FakeStorage;
  embeddings: FakeEmbeddings;
  queue: FakeQueue;
}

function setup(): Setup {
  const repository = new InMemoryIngestion();
  const storage = new FakeStorage();
  const embeddings = new FakeEmbeddings();
  const queue = new FakeQueue();
  const worker = new IngestionWorker(
    repository as unknown as IngestionRepository,
    storage as unknown as StorageService,
    embeddings,
    queue as unknown as QueueService,
  );
  return { worker, repository, storage, embeddings, queue };
}

/** Stores a source file and its `pending` row, as the sources module leaves them. */
async function addSource(
  { repository, storage }: Setup,
  type: SourceType,
  content: Buffer,
): Promise<string> {
  const sourceId = randomUUID();
  await storage.upload(USER_ID, sourceId, content, 'application/octet-stream');
  repository.addSource({ id: sourceId, userId: USER_ID, notebookId: NOTEBOOK_ID, type });
  return sourceId;
}

function job(sourceId: string, overrides: Partial<IngestionJob> = {}): IngestionJob {
  return {
    id: randomUUID(),
    data: { sourceId, userId: USER_ID },
    retryCount: 0,
    signal: new AbortController().signal,
    ...overrides,
  };
}

/** Paragraphs long enough for several chunks, with a marker that must never reach a log. */
function longText(): string {
  return Array.from(
    { length: 6 },
    (_, index) => `Geheimer Absatz ${index}: ${'Inhalt der Quelle. '.repeat(60)}`,
  ).join('\n\n');
}

describe('IngestionWorker', () => {
  let logged: unknown[];

  beforeEach(() => {
    logged = [];
    for (const level of ['log', 'warn', 'error'] as const) {
      vi.spyOn(Logger.prototype, level).mockImplementation((entry: unknown) => {
        logged.push(entry);
      });
    }
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('registration', () => {
    it('registers its handler for the ingestion queue with a concurrency of two', async () => {
      const context = setup();

      await context.worker.onApplicationBootstrap();

      expect(context.queue.workers).toHaveLength(1);
      expect(context.queue.workers[0]?.name).toBe(INGEST_SOURCE_QUEUE);
      expect(context.queue.workers[0]?.options).toEqual({ concurrency: INGESTION_CONCURRENCY });
      expect(INGESTION_CONCURRENCY).toBe(2);
    });

    it('processes the jobs pg-boss hands to the registered handler', async () => {
      const context = setup();
      const sourceId = await addSource(context, 'text', Buffer.from('Ein kurzer Text.'));
      await context.worker.onApplicationBootstrap();

      await context.queue.workers[0]?.handler(job(sourceId) as never);

      expect(context.repository.source(sourceId)?.status).toBe('ready');
    });
  });

  describe('success', () => {
    it.each(['text', 'markdown', 'pasted'] as const)(
      'turns a %s source into embedded chunks and marks it ready',
      async (type) => {
        const context = setup();
        const sourceId = await addSource(context, type, Buffer.from(longText(), 'utf8'));

        await context.worker.process(job(sourceId));

        const { chunks } = context.repository;
        expect(context.repository.source(sourceId)).toMatchObject({ status: 'ready', error: null });
        expect(chunks.length).toBeGreaterThan(1);
        expect(chunks.map((chunk) => chunk.position)).toEqual(chunks.map((_, index) => index));
        for (const [index, chunk] of chunks.entries()) {
          expect(chunk).toMatchObject({
            sourceId,
            notebookId: NOTEBOOK_ID,
            userId: USER_ID,
            page: null,
          });
          expect(chunk.content.length).toBeLessThanOrEqual(CHUNK_SIZE);
          expect(chunk.embedding).toEqual(vectorFor(index));
        }
      },
    );

    it('embeds exactly the chunk texts and passes the job signal on', async () => {
      const context = setup();
      const sourceId = await addSource(context, 'text', Buffer.from(longText(), 'utf8'));
      const ingestion = job(sourceId);

      await context.worker.process(ingestion);

      expect(context.embeddings.calls).toHaveLength(1);
      expect(context.embeddings.calls[0]?.texts).toEqual(
        context.repository.chunks.map((chunk) => chunk.content),
      );
      expect(context.embeddings.calls[0]?.signal).toBe(ingestion.signal);
    });

    it('creates no duplicate chunks when the same job runs twice', async () => {
      const context = setup();
      const sourceId = await addSource(context, 'text', Buffer.from(longText(), 'utf8'));

      await context.worker.process(job(sourceId));
      const firstRun = [...context.repository.chunks];
      await context.worker.process(job(sourceId, { retryCount: 1 }));

      expect(context.repository.chunks).toEqual(firstRun);
      expect(context.repository.source(sourceId)?.status).toBe('ready');
    });

    it('clears the error of an earlier attempt', async () => {
      const context = setup();
      const sourceId = await addSource(context, 'text', Buffer.from('Text.'));
      await context.repository.markFailed(USER_ID, sourceId, INGESTION_FAILED_MESSAGE);

      await context.worker.process(job(sourceId));

      expect(context.repository.source(sourceId)).toMatchObject({ status: 'ready', error: null });
    });
  });

  describe('permanent failures', () => {
    it('fails a PDF without a text layer at once, without embedding or retry', async () => {
      const context = setup();
      const sourceId = await addSource(context, 'pdf', miniPdf(2));

      await expect(context.worker.process(job(sourceId))).resolves.toBeUndefined();

      expect(context.repository.source(sourceId)).toMatchObject({
        status: 'failed',
        error: NO_READABLE_TEXT_MESSAGE,
      });
      expect(context.embeddings.calls).toHaveLength(0);
      expect(context.repository.chunks).toHaveLength(0);
    });

    it('fails text made only of invisible characters instead of marking it ready empty', async () => {
      const context = setup();
      const content = Buffer.from(INVISIBLE_ONLY, 'utf8');
      // Precondition: extraction accepts the text, so only the worker's chunk check can catch it.
      await expect(extractPages(content, 'text')).resolves.toHaveLength(1);
      const sourceId = await addSource(context, 'text', content);

      await expect(context.worker.process(job(sourceId))).resolves.toBeUndefined();

      expect(context.repository.source(sourceId)).toMatchObject({
        status: 'failed',
        error: NO_READABLE_TEXT_MESSAGE,
      });
      expect(context.embeddings.calls).toHaveLength(0);
      expect(context.repository.chunks).toHaveLength(0);
    });
  });

  describe('transient failures', () => {
    it('rethrows so pg-boss retries, and leaves the source processing', async () => {
      const context = setup();
      const sourceId = await addSource(context, 'text', Buffer.from(longText(), 'utf8'));
      const failure = new Error('Rate limited');
      context.embeddings.failWith = failure;

      await expect(context.worker.process(job(sourceId))).rejects.toBe(failure);

      expect(context.repository.source(sourceId)).toMatchObject({
        status: 'processing',
        error: null,
      });
      expect(context.repository.chunks).toHaveLength(0);
    });

    it('keeps the chunks of an earlier run when a retry fails', async () => {
      const context = setup();
      const sourceId = await addSource(context, 'text', Buffer.from(longText(), 'utf8'));
      await context.worker.process(job(sourceId));
      const stored = [...context.repository.chunks];
      context.embeddings.failWith = new Error('Unavailable');

      await expect(context.worker.process(job(sourceId, { retryCount: 1 }))).rejects.toThrow();

      expect(context.repository.chunks).toEqual(stored);
    });

    it('fails the source with a generic message after the last retry', async () => {
      const context = setup();
      const sourceId = await addSource(context, 'text', Buffer.from(longText(), 'utf8'));
      const failure = new Error('Provider down: secret details');
      context.embeddings.failWith = failure;

      await expect(
        context.worker.process(job(sourceId, { retryCount: INGEST_RETRY_LIMIT })),
      ).rejects.toBe(failure);

      expect(context.repository.source(sourceId)).toMatchObject({
        status: 'failed',
        error: INGESTION_FAILED_MESSAGE,
      });
    });

    it('treats an embedding count mismatch as a failure instead of storing chunks', async () => {
      const context = setup();
      const sourceId = await addSource(context, 'text', Buffer.from(longText(), 'utf8'));
      context.embeddings.dropLast = true;

      await expect(context.worker.process(job(sourceId))).rejects.toThrow();

      expect(context.repository.chunks).toHaveLength(0);
    });
  });

  describe('deleted sources', () => {
    it('ends silently if the source was deleted before the job ran', async () => {
      const context = setup();
      const sourceId = await addSource(context, 'text', Buffer.from('Text.'));
      context.repository.deleteSource(sourceId);
      const download = vi.spyOn(context.storage, 'download');

      await expect(context.worker.process(job(sourceId))).resolves.toBeUndefined();

      expect(download).not.toHaveBeenCalled();
      expect(context.embeddings.calls).toHaveLength(0);
    });

    it('ends silently if the source is deleted before its chunks are stored', async () => {
      const context = setup();
      const sourceId = await addSource(context, 'text', Buffer.from(longText(), 'utf8'));
      context.repository.beforeReplace = () => context.repository.deleteSource(sourceId);

      await expect(context.worker.process(job(sourceId))).resolves.toBeUndefined();

      expect(context.repository.chunks).toHaveLength(0);
      expect(context.repository.sources).toHaveLength(0);
    });

    it('ends silently if a deletion mid-run surfaces as another error', async () => {
      const context = setup();
      const sourceId = await addSource(context, 'text', Buffer.from(longText(), 'utf8'));
      // The file and row are gone while the job runs: the download fails.
      vi.spyOn(context.storage, 'download').mockImplementation(() => {
        context.repository.deleteSource(sourceId);
        return Promise.reject(new Error('Object not found'));
      });

      await expect(context.worker.process(job(sourceId))).resolves.toBeUndefined();
    });

    it('ends silently if the store fails because the source vanished, e.g. a foreign key error', async () => {
      const context = setup();
      const sourceId = await addSource(context, 'text', Buffer.from(longText(), 'utf8'));
      context.repository.beforeReplace = () => {
        context.repository.deleteSource(sourceId);
        throw new Error('insert or update on table "chunks" violates foreign key constraint');
      };

      await expect(
        context.worker.process(job(sourceId, { retryCount: INGEST_RETRY_LIMIT })),
      ).resolves.toBeUndefined();
    });

    it("never touches another user's source with the same ID", async () => {
      const context = setup();
      const sourceId = await addSource(context, 'text', Buffer.from('Text.'));
      const foreign = job(sourceId, { data: { sourceId, userId: OTHER_USER_ID } });

      await expect(context.worker.process(foreign)).resolves.toBeUndefined();

      expect(context.repository.source(sourceId)?.status).toBe('pending');
      expect(context.embeddings.calls).toHaveLength(0);
    });
  });

  describe('logging', () => {
    it('logs only IDs, counts, durations and error classes', async () => {
      const context = setup();
      const ready = await addSource(context, 'text', Buffer.from(longText(), 'utf8'));
      const empty = await addSource(context, 'pdf', miniPdf(1));
      const broken = await addSource(context, 'text', Buffer.from(longText(), 'utf8'));
      const ingestion = job(ready);

      await context.worker.process(ingestion);
      await context.worker.process(job(empty));
      context.embeddings.failWith = new Error('Geheimer Absatz 0 in a provider error');
      await expect(context.worker.process(job(broken))).rejects.toThrow();
      await expect(
        context.worker.process(job(broken, { retryCount: INGEST_RETRY_LIMIT })),
      ).rejects.toThrow();

      expect(logged).toContainEqual({
        message: 'Ingestion completed',
        sourceId: ready,
        jobId: ingestion.id,
        durationMs: expect.any(Number) as number,
        chunkCount: context.repository.chunks.length,
      });
      expect(logged).toContainEqual(
        expect.objectContaining({ sourceId: empty, errorClass: 'IngestionError' }),
      );
      for (const entry of logged) {
        expect(typeof entry).toBe('object');
        expect(Object.keys(entry as object).every((key) => ALLOWED_LOG_FIELDS.has(key))).toBe(true);
      }
      const output = JSON.stringify(logged);
      expect(output).not.toContain('Geheimer');
      expect(output).not.toContain(NO_READABLE_TEXT_MESSAGE);
      expect(output).not.toContain(USER_ID);
    });
  });
});
