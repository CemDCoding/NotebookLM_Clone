import type { StoredCitation } from '@notebooklm/shared';
import type { PromptChunk } from '../prompt';

/**
 * Maps cited numbers to the chunks they were numbered as in the prompt:
 * `[n]` refers to `chunks[n - 1]`. Numbers without a chunk are dropped, so a
 * hallucinated `[99]` never becomes a citation (CLAUDE.md section 1, R9).
 * Each number appears once; the result is ordered by number.
 */
export function mapCitations(
  numbers: readonly number[],
  chunks: readonly Pick<PromptChunk, 'sourceId' | 'chunkId' | 'page'>[],
): StoredCitation[] {
  const citations = new Map<number, StoredCitation>();
  for (const n of numbers) {
    const chunk = Number.isInteger(n) && n >= 1 ? chunks[n - 1] : undefined;
    if (chunk !== undefined && !citations.has(n)) {
      citations.set(n, { n, sourceId: chunk.sourceId, chunkId: chunk.chunkId, page: chunk.page });
    }
  }
  return [...citations.values()].sort((a, b) => a.n - b.n);
}
