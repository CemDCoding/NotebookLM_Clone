import {
  CITATION_EXCERPT_MAX_LENGTH,
  type Citation,
  type StoredCitation,
  StoredCitationSchema,
} from '@notebooklm/shared';

/** What a citation shows of the section it points to. */
export interface CitationSection {
  title: string;
  content: string;
}

const ELLIPSIS = '…';

/**
 * Shortens a section to the excerpt shown on hover, at most
 * `CITATION_EXCERPT_MAX_LENGTH` characters. Line breaks and runs of spaces
 * become single spaces, since the popover shows one paragraph. Used for the
 * `citations` event and for the history alike.
 */
export function toExcerpt(content: string): string {
  const text = content.replace(/\s+/g, ' ').trim();
  if (text.length <= CITATION_EXCERPT_MAX_LENGTH) {
    return text;
  }
  let cut = text.slice(0, CITATION_EXCERPT_MAX_LENGTH - ELLIPSIS.length);
  // A cut between the two halves of a surrogate pair would leave half a character.
  if (/[\uD800-\uDBFF]$/.test(cut)) {
    cut = cut.slice(0, -1);
  }
  return `${cut.trimEnd()}${ELLIPSIS}`;
}

/**
 * Resolves a stored reference with the section it points to. Without one the
 * chunk is gone, because its source was deleted, and the citation shows
 * "Quelle gelöscht" (PE-08).
 */
export function resolveCitation(
  citation: StoredCitation,
  section: CitationSection | undefined,
): Citation {
  if (section === undefined) {
    return { ...citation, available: false };
  }
  return {
    ...citation,
    available: true,
    sourceTitle: section.title,
    excerpt: toExcerpt(section.content),
    content: section.content,
  };
}

/**
 * Reads the `citations` column, which is typed `unknown[]` on purpose: every
 * entry is checked against the stored contract, and entries that fail it are
 * dropped instead of failing the whole history.
 */
export function parseStoredCitations(value: unknown): {
  citations: StoredCitation[];
  invalidCount: number;
} {
  const entries: unknown[] = Array.isArray(value) ? value : [value];
  const citations: StoredCitation[] = [];
  for (const entry of entries) {
    const parsed = StoredCitationSchema.safeParse(entry);
    if (parsed.success) {
      citations.push(parsed.data);
    }
  }
  return { citations, invalidCount: entries.length - citations.length };
}
