'use client';

import type { Citation } from '@notebooklm/shared';
import { cn } from 'cn';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { CitationPreview } from './citation-preview';
import { useCitationPanel } from './citation-panel-provider';

interface CitationBadgeProps {
  citation: Citation;
}

/**
 * Clickable citation marker. Hover or keyboard focus shows a preview, a click or Enter opens the
 * side panel with the complete section.
 */
export function CitationBadge({ citation }: CitationBadgeProps) {
  const { openCitation } = useCitationPanel();

  return (
    <HoverCard openDelay={200} closeDelay={100}>
      <HoverCardTrigger asChild>
        <button
          type="button"
          aria-label={`Zitat ${citation.n}`}
          onClick={(event) => openCitation(citation, event.currentTarget)}
          className={cn(
            'mx-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 align-text-top text-xs font-medium tabular-nums transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
            citation.available
              ? 'bg-primary-soft text-primary-soft-foreground hover:bg-primary hover:text-primary-foreground'
              : 'bg-muted text-muted-foreground line-through hover:bg-accent',
          )}
        >
          {citation.n}
        </button>
      </HoverCardTrigger>
      <HoverCardContent side="top" className="w-80">
        <CitationPreview citation={citation} />
      </HoverCardContent>
    </HoverCard>
  );
}
