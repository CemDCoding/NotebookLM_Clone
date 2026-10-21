'use client';

import { AddSourceDialog } from './add-source/add-source-dialog';
import { useSources } from './use-sources';

interface SourceListHeaderProps {
  notebookId: string;
  headingId: string;
}

/** Heading of the source column with the active count and the button to add a source. */
export function SourceListHeader({ notebookId, headingId }: SourceListHeaderProps) {
  // Same query as the list below; TanStack Query fetches it only once.
  const sources = useSources(notebookId);

  return (
    <div className="flex items-start justify-between gap-3 px-2">
      <div className="flex min-w-0 flex-col gap-0.5">
        <h2 id={headingId} className="font-heading text-lg font-medium">
          Quellen
        </h2>
        {sources.isSuccess && sources.data.length > 0 && (
          <p className="text-sm text-muted-foreground">
            {sources.data.filter((source) => source.isActive).length} von {sources.data.length} im
            Chat aktiv
          </p>
        )}
      </div>
      <AddSourceDialog notebookId={notebookId} />
    </div>
  );
}
