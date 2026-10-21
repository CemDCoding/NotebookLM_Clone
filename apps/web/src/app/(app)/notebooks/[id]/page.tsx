import { NotebookIdParamsSchema } from '@notebooklm/shared';
import { MessagesSquare } from 'lucide-react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { SourcePanel } from '@/features/sources/source-panel';
import { NotebookHeader } from './notebook-header';

export const metadata: Metadata = {
  title: 'Notebook – Quellenchat',
};

// Notebook and sources are fetched in the browser: apiFetch needs the session's access token.
// Only the shape of the ID can be checked here, which spares the API requests that must fail.
export default async function NotebookPage({ params }: PageProps<'/notebooks/[id]'>) {
  const { id } = await params;
  if (!NotebookIdParamsSchema.safeParse({ id }).success) {
    notFound();
  }

  return (
    <div className="flex w-full flex-1 flex-col gap-6 px-6 py-6">
      <NotebookHeader notebookId={id} />
      <div className="grid flex-1 grid-cols-[20rem_minmax(0,1fr)] items-start gap-6">
        <SourcePanel notebookId={id} />
        <section
          aria-labelledby="chat-heading"
          className="flex min-h-96 flex-col items-center justify-center gap-3 self-stretch rounded-xl border bg-card px-6 py-16 text-center"
        >
          <span className="flex size-12 items-center justify-center rounded-xl border bg-primary-soft text-primary-soft-foreground">
            <MessagesSquare aria-hidden="true" className="size-6" />
          </span>
          <h2 id="chat-heading" className="font-heading text-lg font-medium">
            Chat folgt
          </h2>
          <p className="max-w-md text-muted-foreground">
            Bald stellst du hier Fragen zu deinen aktiven Quellen und bekommst Antworten mit
            Zitaten.
          </p>
        </section>
      </div>
    </div>
  );
}
