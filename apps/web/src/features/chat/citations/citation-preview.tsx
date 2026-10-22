import type { Citation } from '@notebooklm/shared';
import { formatPage } from './format-page';

interface CitationPreviewProps {
  citation: Citation;
}

/** Popover body of a citation badge: source title, page and a short excerpt. */
export function CitationPreview({ citation }: CitationPreviewProps) {
  if (!citation.available) {
    return (
      <div className="flex flex-col gap-1">
        <p className="font-medium">Quelle gelöscht</p>
        <p className="text-muted-foreground">Der zitierte Abschnitt ist nicht mehr verfügbar.</p>
      </div>
    );
  }

  const page = formatPage(citation.page);

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-col gap-0.5">
        <p className="line-clamp-2 font-medium break-words">{citation.sourceTitle}</p>
        {page && <p className="text-xs text-muted-foreground">{page}</p>}
      </div>
      <p className="line-clamp-6 leading-relaxed text-muted-foreground break-words">
        {citation.excerpt}
      </p>
    </div>
  );
}
