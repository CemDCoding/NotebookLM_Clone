import { Inject, Injectable } from '@nestjs/common';
import { EMBEDDING_PROVIDER, type EmbeddingProvider } from '../llm/embedding.provider';
import { buildSearchQuery, RETRIEVAL_TOP_K } from './build-search-query';
import { RetrievalRepository, type RetrievedChunk } from './retrieval.repository';

export interface RetrieveInput {
  userId: string;
  notebookId: string;
  question: string;
  /** The user's question before this one, so follow-ups find their topic. */
  previousUserQuestion?: string;
  /** Aborted when the client leaves, so the embedding request stops as well. */
  signal?: AbortSignal;
}

/**
 * Finds the chunks a chat answer may draw on (apps/api/CLAUDE.md "retrieval"):
 * embeds the search query with `mistral-embed`, the model that embedded the
 * chunks, and returns the `RETRIEVAL_TOP_K` nearest chunks of the notebook's
 * active, ready sources. Ownership is enforced by the repository: another
 * user's notebook yields no chunks.
 */
@Injectable()
export class RetrievalService {
  constructor(
    @Inject(RetrievalRepository) private readonly repository: RetrievalRepository,
    @Inject(EMBEDDING_PROVIDER) private readonly embeddings: EmbeddingProvider,
  ) {}

  async retrieve(input: RetrieveInput): Promise<RetrievedChunk[]> {
    const query = buildSearchQuery(input.question, input.previousUserQuestion);
    const [embedding] = await this.embeddings.embed([query], input.signal);
    if (!embedding) {
      // The provider guarantees one vector per text; this only guards the type.
      throw new Error('Embedding provider returned no vector for the search query');
    }
    return this.repository.search(input.userId, input.notebookId, embedding, RETRIEVAL_TOP_K);
  }

  /**
   * Whether the notebook has anything to search. The chat checks this before
   * calling any model, so a notebook without usable sources costs nothing.
   */
  hasReadyActiveSources(userId: string, notebookId: string): Promise<boolean> {
    return this.repository.hasReadyActiveSources(userId, notebookId);
  }
}
