import type { RetrievedChunk } from '../retrieval/retrieval.repository';
import type { PromptChunk } from './prompt';

/**
 * Maps retrieval results to the chunk format of prompt and citations, keeping
 * their order. `buildPrompt` and `mapCitations` must get this same array: the
 * chunk at index i is `[i + 1]` in both, so a different order or a separately
 * mapped copy would make a marker point to the wrong section.
 */
export function toPromptChunks(retrieved: readonly RetrievedChunk[]): PromptChunk[] {
  return retrieved.map(({ chunkId, sourceId, sourceTitle, page, content }) => ({
    sourceId,
    chunkId,
    title: sourceTitle,
    page,
    content,
  }));
}
