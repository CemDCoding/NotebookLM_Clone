import type { Citation } from '@notebooklm/shared';
import { SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { formatPage } from './format-page';

interface CitationPanelBodyProps {
  citation: Citation;
}

/** Content of the citation panel; a deleted source keeps only its citation number. */
export function CitationPanelBody({ citation }: CitationPanelBodyProps) {
  if (!citation.available) {
    return (
      <SheetHeader className="border-b pr-12">
        <p className="text-xs font-medium text-primary">Zitat {citation.n}</p>
        <SheetTitle>Quelle gelöscht</SheetTitle>
        <SheetDescription>
          Die Quelle dieses Zitats wurde gelöscht. Der Abschnitt ist nicht mehr verfügbar.
        </SheetDescription>
      </SheetHeader>
    );
  }

  const page = formatPage(citation.page);

  return (
    <>
      <SheetHeader className="border-b pr-12">
        <p className="text-xs font-medium text-primary">Zitat {citation.n}</p>
        <SheetTitle className="break-words">{citation.sourceTitle}</SheetTitle>
        <SheetDescription>{page ?? 'Zitierter Abschnitt'}</SheetDescription>
      </SheetHeader>
      <div className="flex-1 overflow-y-auto p-4">
        <blockquote className="border-l-2 border-primary pl-4 leading-relaxed break-words whitespace-pre-wrap">
          {citation.content}
        </blockquote>
      </div>
    </>
  );
}
