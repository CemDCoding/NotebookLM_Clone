'use client';

import { useId } from 'react';
import { SourceList } from './source-list';
import { useSources } from './use-sources';

interface SourcePanelProps {
  notebookId: string;
}

/** Left column of the notebook view: heading with the active count and the source list. */
export function SourcePanel({ notebookId }: SourcePanelProps) {
  const headingId = useId();
  // Same query as the list below; TanStack Query fetches it only once.
  const sources = useSources(notebookId);

  return (
    <section
      aria-labelledby={headingId}
      className="flex flex-col gap-4 rounded-xl border bg-card p-4"
    >
      <div className="flex flex-col gap-0.5 px-2">
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
      <SourceList notebookId={notebookId} />
    </section>
  );
}
