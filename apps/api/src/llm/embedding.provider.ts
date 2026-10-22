/** Injection token of the `EmbeddingProvider`; feature modules depend only on the interface. */
export const EMBEDDING_PROVIDER = Symbol('EMBEDDING_PROVIDER');

/**
 * The only embedding model in every environment (CLAUDE.md section 6). All
 * vectors must come from the same model, so changing it means re-indexing.
 */
export const EMBEDDING_MODEL = 'mistral-embed';

/** Turns texts into vectors for storing chunks and for searching them. */
export interface EmbeddingProvider {
  /**
   * Returns one vector per text, in the order of `texts`. Every vector has
   * `EMBEDDING_DIMENSIONS` entries, so it fits the `chunks.embedding` column.
   * Aborting `signal` stops the running request and any retry.
   */
  embed(texts: readonly string[], signal?: AbortSignal): Promise<number[][]>;
}

/**
 * The provider answered, but not with what was asked for. Retrying does not
 * help, and the message carries only counts, never input text (DSGVO).
 */
export class EmbeddingResponseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EmbeddingResponseError';
  }
}
