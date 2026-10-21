'use client';

import { useId } from 'react';
import { SourceList } from './source-list';
import { SourceListHeader } from './source-list-header';

interface SourcePanelProps {
  notebookId: string;
}

/** Left column of the notebook view: header with the active count and the source list. */
export function SourcePanel({ notebookId }: SourcePanelProps) {
  const headingId = useId();

  return (
    <section
      aria-labelledby={headingId}
      className="flex flex-col gap-4 rounded-xl border bg-card p-4"
    >
      <SourceListHeader notebookId={notebookId} headingId={headingId} />
      <SourceList notebookId={notebookId} />
    </section>
  );
}
