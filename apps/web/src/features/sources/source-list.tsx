'use client';

import { FileText, RotateCw, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toErrorMessage } from '@/features/notebooks/to-error-message';
import { SourceItem } from './source-item';
import { SourceListSkeleton } from './source-list-skeleton';
import { useSources } from './use-sources';

interface SourceListProps {
  notebookId: string;
}

/** Source list of a notebook with its loading, empty and error states. */
export function SourceList({ notebookId }: SourceListProps) {
  const sources = useSources(notebookId);

  if (sources.isPending) {
    return <SourceListSkeleton />;
  }

  if (sources.isError) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed px-4 py-10 text-center">
        <span className="flex size-10 items-center justify-center rounded-xl border border-destructive/30 bg-destructive/5 text-destructive">
          <TriangleAlert aria-hidden="true" className="size-5" />
        </span>
        <p role="alert" className="text-sm text-muted-foreground">
          Die Quellen konnten nicht geladen werden. {toErrorMessage(sources.error)}
        </p>
        <Button
          variant="outline"
          onClick={() => void sources.refetch()}
          disabled={sources.isFetching}
        >
          <RotateCw aria-hidden="true" data-icon="inline-start" />
          Erneut versuchen
        </Button>
      </div>
    );
  }

  if (sources.data.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed px-4 py-10 text-center">
        <span className="flex size-10 items-center justify-center rounded-xl border bg-primary-soft text-primary-soft-foreground">
          <FileText aria-hidden="true" className="size-5" />
        </span>
        <p className="text-sm text-muted-foreground">
          Noch keine Quellen. Lade ein PDF hoch oder füge Text ein, um loszulegen.
        </p>
      </div>
    );
  }

  return (
    <ul aria-label="Quellen dieses Notebooks" className="flex flex-col gap-1">
      {sources.data.map((source) => (
        <SourceItem key={source.id} notebookId={notebookId} source={source} />
      ))}
    </ul>
  );
}
