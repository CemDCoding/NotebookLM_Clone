'use client';

import type { ExtraProps } from 'react-markdown';
import { CitationBadge } from '../citations/citation-badge';
import { useAnswerCitation } from './answer-citations-context';
import { CITATION_NUMBER_PROPERTY, PENDING_MARKER_PROPERTY } from './remark-citations';

type CitationMarkerProps = React.ComponentProps<'span'> & ExtraProps;

/**
 * Renders the `span` elements of the Markdown tree. Without raw HTML, spans only come from
 * `remarkCitations`, so the data properties cannot be forged by the answer text.
 */
export function CitationMarker({ node, children, ...props }: CitationMarkerProps) {
  const numberProperty = node?.properties[CITATION_NUMBER_PROPERTY];
  const citation = useAnswerCitation(typeof numberProperty === 'number' ? numberProperty : NaN);

  if (numberProperty !== undefined) {
    return citation ? <CitationBadge citation={citation} /> : null;
  }

  if (node?.properties[PENDING_MARKER_PROPERTY] !== undefined) {
    return <span className="text-muted-foreground">{children}</span>;
  }

  return <span {...props}>{children}</span>;
}
