import { randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import type { EmbeddingProvider } from '../llm/embedding.provider';
import { RETRIEVAL_TOP_K } from './build-search-query';
import type { RetrievalRepository, RetrievedChunk } from './retrieval.repository';
import { RetrievalService } from './retrieval.service';

const USER = randomUUID();
const OTHER_USER = randomUUID();
const NOTEBOOK = randomUUID();
const OTHER_NOTEBOOK = randomUUID();

interface StoredChunk extends RetrievedChunk {
  userId: string;
  notebookId: string;
  isActive: boolean;
  status: 'pending' | 'processing' | 'ready' | 'failed';
  embedding: number[];
}

/**
 * In-memory stand-in for the repository that applies the same rules as the
 * SQL: own user, own notebook, active and ready sources, nearest first by
 * cosine distance. The SQL itself is checked in the repository test and
 * against dev at the integration point.
 */
class InMemoryRetrieval {
  readonly chunks: StoredChunk[] = [];

  add(overrides: Partial<StoredChunk> & { embedding: number[] }): StoredChunk {
    const chunk: StoredChunk = {
      chunkId: randomUUID(),
      sourceId: randomUUID(),
      sourceTitle: 'Bericht',
      page: null,
      content: `Abschnitt ${this.chunks.length}`,
      userId: USER,
      notebookId: NOTEBOOK,
      isActive: true,
      status: 'ready',
      ...overrides,
    };
    this.chunks.push(chunk);
    return chunk;
  }

  private usable(userId: string, notebookId: string): StoredChunk[] {
    return this.chunks.filter(
      (chunk) =>
        chunk.userId === userId &&
        chunk.notebookId === notebookId &&
        chunk.isActive &&
        chunk.status === 'ready',
    );
  }

  search(
    userId: string,
    notebookId: string,
    embedding: readonly number[],
    k: number,
  ): Promise<RetrievedChunk[]> {
    const found = this.usable(userId, notebookId)
      .map((chunk) => ({ chunk, distance: cosineDistance(chunk.embedding, embedding) }))
      .sort((a, b) => a.distance - b.distance)
      .slice(0, k)
      .map(({ chunk }) => ({
        chunkId: chunk.chunkId,
        sourceId: chunk.sourceId,
        sourceTitle: chunk.sourceTitle,
        page: chunk.page,
        content: chunk.content,
      }));
    return Promise.resolve(found);
  }

  hasReadyActiveSources(userId: string, notebookId: string): Promise<boolean> {
    return Promise.resolve(this.usable(userId, notebookId).length > 0);
  }
}

function cosineDistance(a: readonly number[], b: readonly number[]): number {
  const dot = a.reduce((sum, value, index) => sum + value * (b[index] ?? 0), 0);
  const norm = (vector: readonly number[]) => Math.hypot(...vector);
  return 1 - dot / (norm(a) * norm(b));
}

const QUERY_VECTOR = [1, 0];

function setup(vector: number[] = QUERY_VECTOR) {
  const store = new InMemoryRetrieval();
  const embed = vi.fn<EmbeddingProvider['embed']>().mockResolvedValue([vector]);
  const service = new RetrievalService(store as unknown as RetrievalRepository, { embed });
  return { store, embed, service };
}

describe('RetrievalService', () => {
  it('embeds the question together with the previous user question', async () => {
    const { embed, service } = setup();
    const controller = new AbortController();

    await service.retrieve({
      userId: USER,
      notebookId: NOTEBOOK,
      question: 'Und der zweite Punkt?',
      previousUserQuestion: 'Welche Risiken gibt es?',
      signal: controller.signal,
    });

    expect(embed).toHaveBeenCalledWith(
      ['Welche Risiken gibt es?\nUnd der zweite Punkt?'],
      controller.signal,
    );
  });

  it('returns the nearest chunks first', async () => {
    const { store, service } = setup();
    const far = store.add({ embedding: [0, 1] });
    const near = store.add({ embedding: [1, 0.1] });
    const middle = store.add({ embedding: [1, 1] });

    const found = await service.retrieve({ userId: USER, notebookId: NOTEBOOK, question: 'Frage' });

    expect(found.map((chunk) => chunk.chunkId)).toEqual([
      near.chunkId,
      middle.chunkId,
      far.chunkId,
    ]);
  });

  it(`returns at most ${RETRIEVAL_TOP_K} chunks`, async () => {
    const { store, service } = setup();
    for (let index = 0; index < RETRIEVAL_TOP_K + 3; index++) {
      store.add({ embedding: [1, index] });
    }

    const found = await service.retrieve({ userId: USER, notebookId: NOTEBOOK, question: 'Frage' });

    expect(found).toHaveLength(RETRIEVAL_TOP_K);
    expect(RETRIEVAL_TOP_K).toBe(8);
  });

  it('never returns chunks of inactive, unfinished or foreign sources', async () => {
    const { store, service } = setup();
    const usable = store.add({ embedding: [0, 1] });
    // Each of these is closer to the query than the usable chunk.
    store.add({ embedding: [1, 0], isActive: false });
    store.add({ embedding: [1, 0], status: 'pending' });
    store.add({ embedding: [1, 0], status: 'processing' });
    store.add({ embedding: [1, 0], status: 'failed' });
    store.add({ embedding: [1, 0], notebookId: OTHER_NOTEBOOK });
    store.add({ embedding: [1, 0], userId: OTHER_USER });

    const found = await service.retrieve({ userId: USER, notebookId: NOTEBOOK, question: 'Frage' });

    expect(found.map((chunk) => chunk.chunkId)).toEqual([usable.chunkId]);
  });

  it("finds nothing in another user's notebook", async () => {
    const { store, service } = setup();
    store.add({ embedding: [1, 0], userId: OTHER_USER, notebookId: OTHER_NOTEBOOK });

    await expect(
      service.retrieve({ userId: USER, notebookId: OTHER_NOTEBOOK, question: 'Frage' }),
    ).resolves.toEqual([]);
    await expect(service.hasReadyActiveSources(USER, OTHER_NOTEBOOK)).resolves.toBe(false);
  });

  it('returns what the prompt and the citations need', async () => {
    const { store, service } = setup();
    const chunk = store.add({ embedding: [1, 0], sourceTitle: 'Studie.pdf', page: 3 });

    const [found] = await service.retrieve({
      userId: USER,
      notebookId: NOTEBOOK,
      question: 'Frage',
    });

    expect(found).toEqual({
      chunkId: chunk.chunkId,
      sourceId: chunk.sourceId,
      sourceTitle: 'Studie.pdf',
      page: 3,
      content: chunk.content,
    });
  });

  it('passes an embedding failure on without searching', async () => {
    const { store, embed, service } = setup();
    const search = vi.spyOn(store, 'search');
    embed.mockRejectedValue(new Error('provider down'));

    await expect(
      service.retrieve({ userId: USER, notebookId: NOTEBOOK, question: 'Frage' }),
    ).rejects.toThrow('provider down');
    expect(search).not.toHaveBeenCalled();
  });

  it('reports whether the notebook has active, ready sources', async () => {
    const { store, service } = setup();
    store.add({ embedding: [1, 0], isActive: false });
    store.add({ embedding: [1, 0], status: 'processing' });

    await expect(service.hasReadyActiveSources(USER, NOTEBOOK)).resolves.toBe(false);

    store.add({ embedding: [1, 0] });

    await expect(service.hasReadyActiveSources(USER, NOTEBOOK)).resolves.toBe(true);
  });
});
