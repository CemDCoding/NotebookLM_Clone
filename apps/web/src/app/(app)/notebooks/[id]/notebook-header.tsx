'use client';

import { ArrowLeft, RotateCw } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { toErrorMessage } from '@/features/notebooks/to-error-message';
import { isNotFoundError } from '@/features/sources/is-not-found-error';
import { useNotebook } from '@/features/sources/use-notebook';
import { NOTEBOOKS_PATH } from '@/lib/supabase/route-access';

interface NotebookHeaderProps {
  notebookId: string;
}

/** Back link and notebook title. An unknown or foreign notebook shows the not-found page. */
export function NotebookHeader({ notebookId }: NotebookHeaderProps) {
  const notebook = useNotebook(notebookId);

  // The notebook is only known after the browser has asked the API with the session's token,
  // so the check happens here and not on the server.
  if (notebook.isError && isNotFoundError(notebook.error)) {
    notFound();
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <Button asChild variant="ghost" size="sm" className="-ml-2.5 text-muted-foreground">
        <Link href={NOTEBOOKS_PATH}>
          <ArrowLeft aria-hidden="true" data-icon="inline-start" />
          Alle Notebooks
        </Link>
      </Button>

      {notebook.isPending && (
        <div role="status" aria-label="Notebook wird geladen">
          <Skeleton className="h-9 w-80" />
        </div>
      )}

      {notebook.isError && (
        <div className="flex flex-wrap items-center gap-4">
          <h1 className="font-heading text-3xl font-semibold tracking-tight">Notebook</h1>
          <p role="alert" className="text-sm text-muted-foreground">
            Der Titel konnte nicht geladen werden. {toErrorMessage(notebook.error)}
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void notebook.refetch()}
            disabled={notebook.isFetching}
          >
            <RotateCw aria-hidden="true" data-icon="inline-start" />
            Erneut versuchen
          </Button>
        </div>
      )}

      {notebook.isSuccess && (
        <h1 className="font-heading text-3xl font-semibold tracking-tight break-words">
          {notebook.data.title}
        </h1>
      )}
    </div>
  );
}
