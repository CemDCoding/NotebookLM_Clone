import { StoredCitationSchema } from '@notebooklm/shared';
import { describe, expect, it } from 'vitest';
import { extractCitationNumbers } from './citation-markers';
import { mapCitations } from './map-citations';

const SOURCE_A = '00000000-0000-4000-8000-00000000000a';
const SOURCE_B = '00000000-0000-4000-8000-00000000000b';

const chunks = [
  { sourceId: SOURCE_A, chunkId: '00000000-0000-4000-8000-000000000001', page: 3 },
  { sourceId: SOURCE_A, chunkId: '00000000-0000-4000-8000-000000000002', page: 4 },
  { sourceId: SOURCE_B, chunkId: '00000000-0000-4000-8000-000000000003', page: null },
];

describe('mapCitations', () => {
  it('maps [n] to the n-th chunk of the prompt', () => {
    expect(mapCitations([1, 3], chunks)).toEqual([
      { n: 1, sourceId: SOURCE_A, chunkId: chunks[0]?.chunkId, page: 3 },
      { n: 3, sourceId: SOURCE_B, chunkId: chunks[2]?.chunkId, page: null },
    ]);
  });

  it('drops numbers without a chunk', () => {
    expect(mapCitations([99, 0, -1, 1.5, 4], chunks)).toEqual([]);
  });

  it('keeps valid citations next to invalid ones', () => {
    expect(mapCitations([99, 2], chunks).map((citation) => citation.n)).toEqual([2]);
  });

  it('removes duplicates', () => {
    expect(mapCitations([2, 2, 1, 2], chunks).map((citation) => citation.n)).toEqual([1, 2]);
  });

  it('orders citations by number', () => {
    expect(mapCitations([3, 1, 2], chunks).map((citation) => citation.n)).toEqual([1, 2, 3]);
  });

  it('returns nothing without chunks', () => {
    expect(mapCitations([1], [])).toEqual([]);
  });

  it('produces citations that match the stored contract', () => {
    for (const citation of mapCitations([1, 2, 3], chunks)) {
      expect(StoredCitationSchema.parse(citation)).toEqual(citation);
    }
  });

  it.each([
    ['[1][2]', [1, 2]],
    ['[1, 2]', [1, 2]],
    ['[1] und nochmals [1]', [1]],
    ['[2] und erfunden [99]', [2]],
  ])('maps the markers of "%s" end to end', (answer, expected) => {
    const citations = mapCitations(extractCitationNumbers(answer), chunks);
    expect(citations.map((citation) => citation.n)).toEqual(expected);
  });
});
