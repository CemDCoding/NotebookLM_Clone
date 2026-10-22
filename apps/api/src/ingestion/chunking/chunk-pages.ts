import type { ExtractedPage } from '../extraction';
import { CHUNK_OVERLAP, CHUNK_SIZE } from './chunking.constants';
import { normalizeText } from './normalize-text';

/** A section of a source as stored in `chunks`, before it is embedded. */
export interface TextChunk {
  content: string;
  page: number | null;
  /** 0-based and continuous across all pages of a source. */
  position: number;
}

/** A piece of text that is never split further, with the separator placed before it in a chunk. */
interface Unit {
  text: string;
  joiner: string;
}

const PARAGRAPH_JOINER = '\n\n';

// Every unit must fit into a chunk next to a full overlap and the longest
// joiner. That keeps every chunk at or below CHUNK_SIZE without exception.
const MAX_UNIT_LENGTH = CHUNK_SIZE - CHUNK_OVERLAP - PARAGRAPH_JOINER.length;

// Whitespace after a sentence end, optionally followed by closing quotes or
// brackets. Abbreviations such as "z. B." also match; that only moves a split
// point inside a long paragraph and never loses text.
const SENTENCE_BOUNDARY = /(?<=[.!?…]["'»«“”‘’)\]]*)\s+/;

// An overlap that starts at a sentence boundary but is shorter than this falls
// back to a word boundary, so the overlap stays close to its target length.
const MIN_SENTENCE_OVERLAP = CHUNK_OVERLAP / 2;

/**
 * The levels at which oversized text is split, coarsest first: paragraphs,
 * sentences, words and, for a single word longer than a unit, fixed slices.
 */
const SPLIT_LEVELS: readonly { split: (text: string) => string[]; joiner: string }[] = [
  { split: (text) => text.split(PARAGRAPH_JOINER), joiner: PARAGRAPH_JOINER },
  { split: (text) => text.split(SENTENCE_BOUNDARY), joiner: ' ' },
  { split: (text) => text.split(/\s+/), joiner: ' ' },
  { split: (text) => sliceText(text, MAX_UNIT_LENGTH), joiner: '' },
];

/**
 * Splits extracted pages into overlapping chunks of at most CHUNK_SIZE
 * characters (apps/api/CLAUDE.md "sources und ingestion", step 2).
 *
 * Chunks never span pages, so every chunk keeps the page a citation names.
 * Within a page, text is split at paragraphs first, then at sentences, then at
 * words. Each chunk after the first of a page repeats about CHUNK_OVERLAP
 * characters of its predecessor, starting at a sentence or word boundary, so
 * a statement cut at a chunk border is still found as a whole.
 * Pages without text after normalization produce no chunks.
 */
export function chunkPages(pages: readonly ExtractedPage[]): TextChunk[] {
  const chunks: TextChunk[] = [];
  for (const { page, text } of pages) {
    for (const content of chunkText(normalizeText(text))) {
      chunks.push({ content, page, position: chunks.length });
    }
  }
  return chunks;
}

function chunkText(text: string): string[] {
  if (text === '') {
    return [];
  }
  const contents: string[] = [];
  let current = '';
  for (const unit of toUnits(text, 0, '')) {
    if (current === '') {
      current = unit.text;
      continue;
    }
    const extended = current + unit.joiner + unit.text;
    if (extended.length <= CHUNK_SIZE) {
      current = extended;
      continue;
    }
    contents.push(current);
    const overlap = overlapOf(current);
    current = overlap === '' ? unit.text : overlap + unit.joiner + unit.text;
  }
  contents.push(current);
  return contents;
}

/** Splits text recursively until every unit is at most MAX_UNIT_LENGTH characters long. */
function toUnits(text: string, level: number, joiner: string): Unit[] {
  const splitLevel = SPLIT_LEVELS[level];
  if (text.length <= MAX_UNIT_LENGTH || splitLevel === undefined) {
    return [{ text, joiner }];
  }
  return splitLevel
    .split(text)
    .filter((part) => part !== '')
    .flatMap((part, index) => toUnits(part, level + 1, index === 0 ? joiner : splitLevel.joiner));
}

/**
 * The end of a chunk that the next chunk repeats: at most CHUNK_OVERLAP
 * characters, starting at a sentence boundary if that keeps it long enough,
 * otherwise at a word boundary. Inside a single overlong word it is a hard cut.
 */
function overlapOf(chunk: string): string {
  const window = chunk.slice(-CHUNK_OVERLAP);
  const sentenceStart = SENTENCE_BOUNDARY.exec(window);
  if (sentenceStart !== null) {
    const overlap = window.slice(sentenceStart.index + sentenceStart[0].length);
    if (overlap.length >= MIN_SENTENCE_OVERLAP) {
      return overlap;
    }
  }
  const wordStart = /\s+/.exec(window);
  if (wordStart === null) {
    // A window cut through an overlong word must not start with half a surrogate pair.
    return isLowSurrogate(window.charCodeAt(0)) ? window.slice(1) : window;
  }
  return window.slice(wordStart.index + wordStart[0].length).trim();
}

/** Cuts text into slices of at most `length` code units without splitting a surrogate pair. */
function sliceText(text: string, length: number): string[] {
  const slices: string[] = [];
  let start = 0;
  while (start < text.length) {
    let end = Math.min(start + length, text.length);
    if (end < text.length && isLowSurrogate(text.charCodeAt(end))) {
      end -= 1;
    }
    slices.push(text.slice(start, end));
    start = end;
  }
  return slices;
}

function isLowSurrogate(code: number): boolean {
  return code >= 0xdc00 && code <= 0xdfff;
}
