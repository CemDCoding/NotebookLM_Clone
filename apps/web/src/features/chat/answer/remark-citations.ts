import type { Citation } from '@notebooklm/shared';
import { processCitations, type CitationSegment } from './process-citations';

/**
 * The few mdast fields this plugin touches. Declared locally because the full `mdast` types are
 * only a transitive dependency of react-markdown.
 */
interface MarkdownNode {
  type: string;
  value?: string;
  children?: MarkdownNode[];
  data?: {
    hName?: string;
    hProperties?: Record<string, string | number>;
    hChildren?: { type: 'text'; value: string }[];
  };
}

export interface RemarkCitationsOptions {
  /** `null` while the answer streams, see `processCitations`. */
  citations: Citation[] | null;
}

/** hast properties of the marker elements, read back by the Markdown renderer. */
export const CITATION_NUMBER_PROPERTY = 'dataCitationNumber';
export const PENDING_MARKER_PROPERTY = 'dataCitationPending';

// A badge is a button and must not end up inside a link; code shows its text verbatim.
const SKIPPED_PARENTS = new Set(['link', 'linkReference']);

/**
 * Remark plugin that replaces citation markers in text nodes with marker elements.
 *
 * It works on the syntax tree instead of the raw string, so markers inside code stay untouched
 * and no HTML string is ever built: the markers become `span` elements with data properties that
 * `AnswerMarkdown` renders as React components.
 */
export function remarkCitations({ citations }: RemarkCitationsOptions) {
  return (tree: MarkdownNode): void => {
    transformChildren(tree, citations);
  };
}

function transformChildren(parent: MarkdownNode, citations: Citation[] | null): void {
  if (!parent.children || SKIPPED_PARENTS.has(parent.type)) {
    return;
  }

  parent.children = parent.children.flatMap((child) => {
    if (child.type === 'text' && child.value !== undefined) {
      return processCitations(child.value, citations).map(toMarkdownNode);
    }
    transformChildren(child, citations);
    return [child];
  });
}

function toMarkdownNode(segment: CitationSegment): MarkdownNode {
  switch (segment.kind) {
    case 'text':
      return { type: 'text', value: segment.text };
    case 'pending':
      return {
        type: 'citationMarker',
        data: {
          hName: 'span',
          hProperties: { [PENDING_MARKER_PROPERTY]: 'true' },
          hChildren: [{ type: 'text', value: segment.text }],
        },
      };
    case 'citation':
      return {
        type: 'citationMarker',
        data: {
          hName: 'span',
          hProperties: { [CITATION_NUMBER_PROPERTY]: segment.citation.n },
          hChildren: [],
        },
      };
  }
}
