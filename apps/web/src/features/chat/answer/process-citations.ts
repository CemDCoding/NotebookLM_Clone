import type { Citation } from '@notebooklm/shared';

/**
 * A piece of answer text after citation processing:
 * - `text`: plain text,
 * - `pending`: a marker seen while streaming, before the API has confirmed any citation,
 * - `citation`: a marker the API confirmed, rendered as a badge.
 */
export type CitationSegment =
  | { kind: 'text'; text: string }
  | { kind: 'pending'; text: string }
  | { kind: 'citation'; citation: Citation };

// Matches `[1]` and lists like `[1, 2]`, `[1;2]` or `[ 5 ,6 ]`. Must stay in sync with
// `CITATION_MARKER` in the API (`chat/citations/citation-markers.ts`): a marker the API maps to a
// chunk has to become a badge here, and one it ignores must not.
const MARKER_PATTERN = /\[\s*(\d+(?:\s*[,;]\s*\d+)*)\s*\]/g;

const NUMBER_SEPARATOR = /[,;]/;

// Only spaces and tabs: a removed marker must never swallow a line break of the Markdown.
const TRAILING_INLINE_SPACE = /[ \t]+$/;

/**
 * Splits answer text into text and citation segments.
 *
 * `citations` is `null` while the answer streams: every marker then stays visible as a muted
 * `pending` segment, because the valid numbers are not known yet. Once the `citations` event has
 * arrived, only numbers contained in it become badges. All other markers are removed together
 * with the space in front of them, so no invented citation stays visible (CLAUDE.md section 1).
 */
export function processCitations(text: string, citations: Citation[] | null): CitationSegment[] {
  const byNumber = citations ? new Map(citations.map((citation) => [citation.n, citation])) : null;
  const segments: CitationSegment[] = [];
  let cursor = 0;

  for (const match of text.matchAll(MARKER_PATTERN)) {
    appendText(segments, text.slice(cursor, match.index));
    cursor = match.index + match[0].length;

    if (byNumber === null) {
      segments.push({ kind: 'pending', text: match[0] });
      continue;
    }

    const resolved = uniqueNumbers(match[1] ?? '')
      .map((n) => byNumber.get(n))
      .filter((citation) => citation !== undefined);

    if (resolved.length === 0) {
      trimLastText(segments);
      continue;
    }

    for (const citation of resolved) {
      segments.push({ kind: 'citation', citation });
    }
  }

  appendText(segments, text.slice(cursor));
  return segments;
}

function uniqueNumbers(group: string): number[] {
  return [
    ...new Set(group.split(NUMBER_SEPARATOR).map((part) => Number.parseInt(part.trim(), 10))),
  ];
}

// Merges with a preceding text segment so removed markers leave no fragmented text behind.
function appendText(segments: CitationSegment[], text: string): void {
  if (text === '') {
    return;
  }
  const last = segments.at(-1);
  if (last?.kind === 'text') {
    last.text += text;
  } else {
    segments.push({ kind: 'text', text });
  }
}

function trimLastText(segments: CitationSegment[]): void {
  const last = segments.at(-1);
  if (last?.kind !== 'text') {
    return;
  }
  last.text = last.text.replace(TRAILING_INLINE_SPACE, '');
  if (last.text === '') {
    segments.pop();
  }
}
