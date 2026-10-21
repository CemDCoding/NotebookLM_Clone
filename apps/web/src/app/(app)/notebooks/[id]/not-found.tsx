import { ArrowLeft, FileQuestion } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { NOTEBOOKS_PATH } from '@/lib/supabase/route-access';

// Missing and foreign notebooks look the same, so the text does not say which one it was.
export default function NotebookNotFound() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col items-center justify-center gap-4 px-6 py-16 text-center">
      <span className="flex size-12 items-center justify-center rounded-xl border bg-primary-soft text-primary-soft-foreground">
        <FileQuestion aria-hidden="true" className="size-6" />
      </span>
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          Notebook nicht gefunden
        </h1>
        <p className="max-w-md text-muted-foreground">
          Dieses Notebook gibt es nicht oder nicht mehr. Wähle ein anderes aus deiner Übersicht.
        </p>
      </div>
      <Button asChild variant="outline">
        <Link href={NOTEBOOKS_PATH}>
          <ArrowLeft aria-hidden="true" data-icon="inline-start" />
          Zu deinen Notebooks
        </Link>
      </Button>
    </div>
  );
}
