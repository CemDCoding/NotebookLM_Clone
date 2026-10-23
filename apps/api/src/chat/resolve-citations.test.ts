import { CITATION_EXCERPT_MAX_LENGTH, CitationSchema } from '@notebooklm/shared';
import { describe, expect, it } from 'vitest';
import { parseStoredCitations, resolveCitation, toExcerpt } from './resolve-citations';

const stored = {
  n: 1,
  sourceId: '00000000-0000-4000-8000-00000000000a',
  chunkId: '00000000-0000-4000-8000-000000000001',
  page: 3,
};

describe('toExcerpt', () => {
  it('keeps a short section, with whitespace collapsed', () => {
    expect(toExcerpt('  Erste Zeile.\n\nZweite   Zeile.  ')).toBe('Erste Zeile. Zweite Zeile.');
  });

  it('cuts a long section to the maximum length with an ellipsis', () => {
    const excerpt = toExcerpt('Wort '.repeat(1_000));

    expect(excerpt.length).toBeLessThanOrEqual(CITATION_EXCERPT_MAX_LENGTH);
    expect(excerpt.endsWith('…')).toBe(true);
    expect(excerpt.startsWith('Wort Wort')).toBe(true);
  });

  it('keeps a section of exactly the maximum length unchanged', () => {
    const text = 'a'.repeat(CITATION_EXCERPT_MAX_LENGTH);
    expect(toExcerpt(text)).toBe(text);
  });

  it('never splits a character made of two code units', () => {
    const excerpt = toExcerpt(`${'a'.repeat(CITATION_EXCERPT_MAX_LENGTH - 2)}😀${'b'.repeat(10)}`);

    expect(excerpt).toBe(`${'a'.repeat(CITATION_EXCERPT_MAX_LENGTH - 2)}…`);
  });
});

describe('resolveCitation', () => {
  it('adds title, excerpt and the full section of an existing chunk', () => {
    const content = 'x'.repeat(3_000);
    const citation = resolveCitation(stored, { title: 'Handbuch.pdf', content });

    expect(citation).toEqual({
      ...stored,
      available: true,
      sourceTitle: 'Handbuch.pdf',
      excerpt: toExcerpt(content),
      content,
    });
    expect(CitationSchema.parse(citation)).toEqual(citation);
  });

  it('marks a citation without its chunk as unavailable', () => {
    const citation = resolveCitation(stored, undefined);

    expect(citation).toEqual({ ...stored, available: false });
    expect(CitationSchema.parse(citation)).toEqual(citation);
  });
});

describe('parseStoredCitations', () => {
  it('keeps valid references and strips anything else they carry', () => {
    expect(parseStoredCitations([{ ...stored, excerpt: 'Alter Text' }])).toEqual({
      citations: [stored],
      invalidCount: 0,
    });
  });

  it('drops invalid entries and counts them', () => {
    expect(parseStoredCitations([stored, { ...stored, n: 0 }, 'kaputt', null, { n: 2 }])).toEqual({
      citations: [stored],
      invalidCount: 4,
    });
  });

  it('treats a value that is no array as one invalid entry', () => {
    expect(parseStoredCitations({ broken: true })).toEqual({ citations: [], invalidCount: 1 });
  });
});
