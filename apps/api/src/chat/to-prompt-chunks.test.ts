import { describe, expect, it } from 'vitest';
import type { RetrievedChunk } from '../retrieval/retrieval.repository';
import { extractCitationNumbers, mapCitations } from './citations';
import { buildPrompt } from './prompt';
import { toPromptChunks } from './to-prompt-chunks';

const retrieved: RetrievedChunk[] = [
  {
    chunkId: '00000000-0000-4000-8000-000000000001',
    sourceId: '00000000-0000-4000-8000-00000000000a',
    sourceTitle: 'Handbuch.pdf',
    page: 3,
    content: 'Die Frist endet am 31. März.',
  },
  {
    chunkId: '00000000-0000-4000-8000-000000000002',
    sourceId: '00000000-0000-4000-8000-00000000000b',
    sourceTitle: 'Notizen',
    page: null,
    content: 'Anträge gehen an das Bürgeramt.',
  },
];

describe('toPromptChunks', () => {
  it('maps the source title to title and keeps all other fields', () => {
    expect(toPromptChunks(retrieved)).toEqual([
      {
        chunkId: retrieved[0]?.chunkId,
        sourceId: retrieved[0]?.sourceId,
        title: 'Handbuch.pdf',
        page: 3,
        content: 'Die Frist endet am 31. März.',
      },
      {
        chunkId: retrieved[1]?.chunkId,
        sourceId: retrieved[1]?.sourceId,
        title: 'Notizen',
        page: null,
        content: 'Anträge gehen an das Bürgeramt.',
      },
    ]);
  });

  it('keeps the retrieval order, so [n] in prompt and citations is the same chunk', () => {
    const chunks = toPromptChunks(retrieved);
    const system = buildPrompt({ chunks, history: [], question: 'Wohin?' })[0]?.content ?? '';

    expect(system.indexOf('<source n="2" title="Notizen">')).toBeGreaterThan(-1);
    expect(mapCitations(extractCitationNumbers('Bürgeramt [2].'), chunks)).toEqual([
      { n: 2, sourceId: retrieved[1]?.sourceId, chunkId: retrieved[1]?.chunkId, page: null },
    ]);
  });

  it('returns nothing for no chunks', () => {
    expect(toPromptChunks([])).toEqual([]);
  });
});
