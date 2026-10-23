import { describe, expect, it } from 'vitest';
import type { ExtractedPage } from '../extraction';
import { chunkPages, type TextChunk } from './chunk-pages';
import { CHUNK_OVERLAP, CHUNK_SIZE } from './chunking.constants';

/** A distinct German sentence of roughly 60 characters, so tests can find each one. */
function sentence(index: number): string {
  return `Satz ${index} erzählt von Äpfeln, Birnen und großen Bäumen.`;
}

function sentences(from: number, count: number): string[] {
  return Array.from({ length: count }, (_, offset) => sentence(from + offset));
}

/** A paragraph of `count` sentences; ids continue across paragraphs. */
function paragraphs(count: number, sentencesEach: number): string[] {
  return Array.from({ length: count }, (_, index) =>
    sentences(index * sentencesEach, sentencesEach).join(' '),
  );
}

function textPage(text: string, page: number | null = null): ExtractedPage {
  return { page, text };
}

/** Text a chunk shares with the start of its successor. */
function sharedText(previous: TextChunk, next: TextChunk): string {
  for (let length = Math.min(previous.content.length, next.content.length); length > 0; length--) {
    if (previous.content.endsWith(next.content.slice(0, length))) {
      return next.content.slice(0, length);
    }
  }
  return '';
}

/** Every chunk paired with its successor. */
function successivePairs(chunks: readonly TextChunk[]): [TextChunk, TextChunk][] {
  const pairs: [TextChunk, TextChunk][] = [];
  let previous: TextChunk | undefined;
  for (const chunk of chunks) {
    if (previous !== undefined) {
      pairs.push([previous, chunk]);
    }
    previous = chunk;
  }
  return pairs;
}

function expectWithinSize(chunks: readonly TextChunk[]): void {
  for (const chunk of chunks) {
    expect(chunk.content.length).toBeLessThanOrEqual(CHUNK_SIZE);
  }
}

describe('chunkPages', () => {
  it('keeps a short page as one chunk with its page number', () => {
    expect(chunkPages([textPage('Ein kurzer Text.', 4)])).toEqual([
      { content: 'Ein kurzer Text.', page: 4, position: 0 },
    ]);
  });

  it('keeps page = null for text without pages', () => {
    expect(chunkPages([textPage('Notiz ohne Seiten.')])).toEqual([
      { content: 'Notiz ohne Seiten.', page: null, position: 0 },
    ]);
  });

  it('creates no chunks for empty pages and numbers the rest continuously', () => {
    const chunks = chunkPages([
      textPage('Seite eins.', 1),
      textPage('', 2),
      textPage(' \n\t ', 3),
      textPage('Seite vier.', 4),
    ]);

    expect(chunks).toEqual([
      { content: 'Seite eins.', page: 1, position: 0 },
      { content: 'Seite vier.', page: 4, position: 1 },
    ]);
  });

  it('returns no chunks for no pages', () => {
    expect(chunkPages([])).toEqual([]);
  });

  it('never lets a chunk span two pages', () => {
    const chunks = chunkPages([
      textPage(paragraphs(4, 20).join('\n\n'), 1),
      textPage(paragraphs(4, 20).join('\n\n'), 2),
    ]);

    const firstOfPageTwo = chunks.findIndex((chunk) => chunk.page === 2);
    expect(firstOfPageTwo).toBeGreaterThan(1);
    expect(chunks.slice(firstOfPageTwo).every((chunk) => chunk.page === 2)).toBe(true);
    // A page starts fresh, without an overlap from the previous page.
    expect(chunks[firstOfPageTwo]?.content.startsWith(sentence(0))).toBe(true);
    expect(chunks.map((chunk) => chunk.position)).toEqual(chunks.map((_, index) => index));
  });

  it('normalizes whitespace and control characters in the content', () => {
    const [chunk] = chunkPages([
      textPage('  Erste\u00A0Zeile\t mit\u0007Lücken \r\n\r\n\r\n Zweiter Absatz '),
    ]);

    expect(chunk?.content).toBe('Erste Zeile mit Lücken\n\nZweiter Absatz');
  });

  describe('with text longer than one chunk', () => {
    // About 24.000 characters in paragraphs of about 1.200 characters.
    const text = paragraphs(20, 20).join('\n\n');
    const chunks = chunkPages([textPage(text, 7)]);

    it('stays within the chunk size', () => {
      expect(chunks.length).toBeGreaterThan(text.length / CHUNK_SIZE);
      expectWithinSize(chunks);
    });

    it('fills chunks close to the target size', () => {
      for (const chunk of chunks.slice(0, -1)) {
        expect(chunk.content.length).toBeGreaterThan(CHUNK_SIZE / 2);
      }
    });

    it('keeps the page and numbers positions continuously', () => {
      expect(chunks.every((chunk) => chunk.page === 7)).toBe(true);
      expect(chunks.map((chunk) => chunk.position)).toEqual(chunks.map((_, index) => index));
    });

    it('splits between paragraphs', () => {
      for (const chunk of chunks) {
        expect(chunk.content.endsWith('.')).toBe(true);
      }
    });

    it('repeats about CHUNK_OVERLAP characters, starting at a sentence', () => {
      for (const [previous, next] of successivePairs(chunks)) {
        const overlap = sharedText(previous, next);
        expect(overlap.length).toBeGreaterThanOrEqual(CHUNK_OVERLAP / 2);
        expect(overlap.length).toBeLessThanOrEqual(CHUNK_OVERLAP);
        expect(overlap).toMatch(/^Satz \d+ /);
      }
    });

    it('loses no sentence', () => {
      const allContent = chunks.map((chunk) => chunk.content).join('\n');
      for (let index = 0; index < 400; index++) {
        expect(allContent).toContain(sentence(index));
      }
    });
  });

  it('splits a very long paragraph at sentence ends', () => {
    const text = sentences(0, 300).join(' ');

    const chunks = chunkPages([textPage(text)]);

    expect(chunks.length).toBeGreaterThan(5);
    expectWithinSize(chunks);
    for (const chunk of chunks) {
      expect(chunk.content).toMatch(/^Satz \d+ /);
      expect(chunk.content.endsWith('Bäumen.')).toBe(true);
    }
  });

  it('splits a very long sentence at word boundaries', () => {
    const words = Array.from({ length: 2000 }, (_, index) => `wort${index}`);

    const chunks = chunkPages([textPage(words.join(' '))]);

    expectWithinSize(chunks);
    const vocabulary = new Set(words);
    for (const chunk of chunks) {
      for (const word of chunk.content.split(' ')) {
        expect(vocabulary.has(word)).toBe(true);
      }
    }
    expect(chunks.at(-1)?.content.endsWith('wort1999')).toBe(true);
  });

  it('cuts a single overlong word into overlapping slices without losing characters', () => {
    // Concatenated numbers never repeat, so the overlap between slices is unambiguous.
    const word = Array.from({ length: 3_000 }, (_, index) => String(index))
      .join('')
      .slice(0, 10_000);

    const chunks = chunkPages([textPage(word)]);

    expect(chunks.length).toBeGreaterThan(3);
    expectWithinSize(chunks);
    const rebuilt =
      (chunks[0]?.content ?? '') +
      successivePairs(chunks)
        .map(([previous, next]) => next.content.slice(sharedText(previous, next).length))
        .join('');
    expect(rebuilt).toBe(word);
  });

  it('never splits a character outside the basic plane', () => {
    const chunks = chunkPages([textPage('📄'.repeat(5_000))]);

    expectWithinSize(chunks);
    for (const chunk of chunks) {
      expect(Buffer.from(chunk.content, 'utf8').toString('utf8')).toBe(chunk.content);
    }
  });

  it('counts umlauts as single characters, even when the PDF decomposed them', () => {
    const decomposed = 'A\u0308rger u\u0308ber O\u0308l. '.repeat(400);

    const chunks = chunkPages([textPage(decomposed)]);

    expectWithinSize(chunks);
    expect(chunks[0]?.content.startsWith('Ärger über Öl.')).toBe(true);
    expect(chunks.some((chunk) => chunk.content.includes('\u0308'))).toBe(false);
  });
});
