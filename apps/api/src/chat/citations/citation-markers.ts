// A citation marker such as `[1]`, or a list such as `[1, 2]` or `[1;2]`.
// `[1][2]` is two markers. Global, so callers must not keep its `lastIndex`
// between calls: `matchAll` and `replace` work on internal copies.
const CITATION_MARKER = /\[\s*(\d+(?:\s*[,;]\s*\d+)*)\s*\]/g;

/**
 * The numbers cited in an answer, in order of first appearance and without
 * duplicates. Whether a number refers to an existing chunk is decided by
 * `mapCitations`.
 */
export function extractCitationNumbers(text: string): number[] {
  const numbers = new Set<number>();
  for (const match of text.matchAll(CITATION_MARKER)) {
    for (const digits of (match[1] ?? '').split(/[,;]/)) {
      numbers.add(Number(digits.trim()));
    }
  }
  return [...numbers];
}

/**
 * Removes citation markers and the whitespace before them. Used for earlier
 * answers in the prompt history: their numbers referred to the chunks of
 * their own turn, and if the model saw them next to the current, differently
 * numbered chunks, it could repeat a stale number and cite the wrong section.
 */
export function stripCitationMarkers(text: string): string {
  return text.replace(new RegExp(String.raw`\s*${CITATION_MARKER.source}`, 'g'), '');
}
