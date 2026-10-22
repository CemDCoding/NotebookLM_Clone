'use client';

import type { Citation } from '@notebooklm/shared';
import { useMemo } from 'react';
import Markdown, { type Options } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { AnswerCitationsContext } from './answer-citations-context';
import { markdownComponents } from './markdown-components';
import { remarkCitations } from './remark-citations';

// Images would load any URL the model writes, so a prompt injection in a source could send data
// to a foreign server just by being displayed (CLAUDE.md section 7, prompt injection).
const DISALLOWED_ELEMENTS = ['img'];

interface AnswerMarkdownProps {
  content: string;
  /**
   * `null` while the answer streams: markers stay muted text. Afterwards the citations of the
   * `citations` event or the history; only their numbers become badges.
   */
  citations: Citation[] | null;
}

/**
 * Renders an assistant answer as Markdown with citation badges.
 *
 * Raw HTML is never interpreted: react-markdown runs without `rehype-raw`, so HTML in the answer
 * is shown as text (CLAUDE.md section 7, hardening). Badges need a `CitationPanelProvider` above.
 */
export function AnswerMarkdown({ content, citations }: AnswerMarkdownProps) {
  const remarkPlugins = useMemo<Options['remarkPlugins']>(
    () => [remarkGfm, [remarkCitations, { citations }]],
    [citations],
  );
  const citationsByNumber = useMemo(
    () => new Map((citations ?? []).map((citation) => [citation.n, citation])),
    [citations],
  );

  return (
    <AnswerCitationsContext.Provider value={citationsByNumber}>
      <div className="flex flex-col gap-3 text-sm break-words">
        <Markdown
          remarkPlugins={remarkPlugins}
          components={markdownComponents}
          disallowedElements={DISALLOWED_ELEMENTS}
        >
          {content}
        </Markdown>
      </div>
    </AnswerCitationsContext.Provider>
  );
}
