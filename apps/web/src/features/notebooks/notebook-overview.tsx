'use client';

import { NotebookPen, RotateCw, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { NotebookCard } from './notebook-card';
import { NotebookGridSkeleton } from './notebook-grid-skeleton';
import { toErrorMessage } from './to-error-message';
import { useNotebooks } from './use-notebooks';

/** Notebook list with its loading, empty and error states. */
export function NotebookOverview() {
  const notebooks = useNotebooks();

  if (notebooks.isPending) {
    return <NotebookGridSkeleton />;
  }

  if (notebooks.isError) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed px-6 py-16 text-center">
        <span className="flex size-12 items-center justify-center rounded-xl border border-destructive/30 bg-destructive/5 text-destructive">
          <TriangleAlert aria-hidden="true" className="size-6" />
        </span>
        <p role="alert" className="max-w-md text-muted-foreground">
          Deine Notebooks konnten nicht geladen werden. {toErrorMessage(notebooks.error)}
        </p>
        <Button
          variant="outline"
          onClick={() => void notebooks.refetch()}
          disabled={notebooks.isFetching}
        >
          <RotateCw aria-hidden="true" data-icon="inline-start" />
          Erneut versuchen
        </Button>
      </div>
    );
  }

  if (notebooks.data.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed px-6 py-16 text-center">
        <span className="flex size-12 items-center justify-center rounded-xl border bg-primary-soft text-primary-soft-foreground">
          <NotebookPen aria-hidden="true" className="size-6" />
        </span>
        <div className="flex flex-col gap-1">
          <h2 className="font-heading text-lg font-medium">Noch keine Notebooks</h2>
          <p className="text-muted-foreground">
            Lege mit „Neues Notebook“ dein erstes Notebook an und füge danach deine Quellen hinzu.
          </p>
        </div>
      </div>
    );
  }

  return (
    <ul aria-label="Deine Notebooks" className="grid grid-cols-3 gap-4">
      {notebooks.data.map((notebook) => (
        <NotebookCard key={notebook.id} notebook={notebook} />
      ))}
    </ul>
  );
}
