import type { Citation } from '@notebooklm/shared';
import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { AnswerMarkdown } from './answer/answer-markdown';

interface AnswerBubbleProps {
  content: string;
  /** `null` while the answer streams, see `AnswerMarkdown`. */
  citations: Citation[] | null;
  aborted?: boolean;
  /** German text of a failed answer, shown below the text received so far. */
  error?: string | null;
  /** Shown below the text, e.g. the typing indicator. */
  children?: ReactNode;
  /** Announces new text to screen readers; only the answer that is streaming sets it. */
  live?: boolean;
  /** Tells screen readers the text is still growing, so they announce it as a whole. */
  busy?: boolean;
}

export function AnswerBubble({
  content,
  citations,
  aborted,
  error,
  children,
  live,
  busy,
}: AnswerBubbleProps) {
  return (
    <li
      aria-live={live ? 'polite' : undefined}
      aria-busy={busy || undefined}
      className="flex flex-col items-start gap-2"
    >
      {content !== '' && (
        <div className="w-full">
          <span className="sr-only">Antwort: </span>
          <AnswerMarkdown content={content} citations={citations} />
        </div>
      )}
      {children}
      {aborted && (
        <Badge variant="outline" className="text-muted-foreground">
          Abgebrochen
        </Badge>
      )}
      {error && (
        <p
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
        >
          {error}
        </p>
      )}
    </li>
  );
}
