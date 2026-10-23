import type OpenAI from 'openai';
import { EMBEDDING_DIMENSIONS } from '../db/schema';
import {
  EMBEDDING_MODEL,
  type EmbeddingProvider,
  EmbeddingResponseError,
} from './embedding.provider';
import { type BackoffOptions, withBackoff } from './with-backoff';

/** Texts per request, conservative against provider limits (PE-14). */
export const EMBEDDING_BATCH_SIZE = 16;

/** Only the part of the `openai` client this provider uses, so tests fake just that. */
export type EmbeddingsClient = Pick<OpenAI, 'embeddings'>;

export interface OpenAiCompatibleEmbeddingOptions {
  model?: string;
  /** Passed to `withBackoff`; tests replace the waiting. */
  backoff?: Omit<BackoffOptions, 'signal'>;
}

/**
 * `EmbeddingProvider` for any OpenAI-compatible API, used with Mistral. Sends
 * batches one after another: the worker already runs jobs in parallel, and
 * sequential batches keep the request rate predictable under rate limits.
 */
export class OpenAiCompatibleEmbeddingProvider implements EmbeddingProvider {
  private readonly model: string;
  private readonly backoff: Omit<BackoffOptions, 'signal'>;

  constructor(
    private readonly client: EmbeddingsClient,
    options: OpenAiCompatibleEmbeddingOptions = {},
  ) {
    this.model = options.model ?? EMBEDDING_MODEL;
    this.backoff = options.backoff ?? {};
  }

  async embed(texts: readonly string[], signal?: AbortSignal): Promise<number[][]> {
    const vectors: number[][] = [];
    for (let start = 0; start < texts.length; start += EMBEDDING_BATCH_SIZE) {
      const batch = texts.slice(start, start + EMBEDDING_BATCH_SIZE);
      vectors.push(...(await this.embedBatch(batch, signal)));
    }
    return vectors;
  }

  private async embedBatch(batch: string[], signal: AbortSignal | undefined): Promise<number[][]> {
    const response = await withBackoff(
      (attemptSignal) =>
        this.client.embeddings.create(
          // The SDK defaults to base64, which not every compatible API supports.
          { model: this.model, input: batch, encoding_format: 'float' },
          { signal: attemptSignal },
        ),
      { ...this.backoff, signal },
    );

    if (response.data.length !== batch.length) {
      throw new EmbeddingResponseError(
        `Expected ${batch.length} embeddings, received ${response.data.length}`,
      );
    }
    // The API reports each vector's input index; order by it instead of
    // trusting the response order, so no chunk is stored with another's vector.
    const vectors = new Array<number[] | undefined>(batch.length);
    for (const item of response.data) {
      if (item.embedding.length !== EMBEDDING_DIMENSIONS) {
        throw new EmbeddingResponseError(
          `Expected ${EMBEDDING_DIMENSIONS} dimensions, received ${item.embedding.length}`,
        );
      }
      if (item.index < 0 || item.index >= batch.length || vectors[item.index] !== undefined) {
        throw new EmbeddingResponseError(`Unexpected embedding index ${item.index}`);
      }
      vectors[item.index] = item.embedding;
    }
    return vectors as number[][];
  }
}
