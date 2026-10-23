import { NotebookIdParamsSchema } from '@notebooklm/shared';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ChatPanel } from '@/features/chat/chat-panel';
import { SourcePanel } from '@/features/sources/source-panel';
import { NotebookHeader } from './notebook-header';

export const metadata: Metadata = {
  title: 'Notebook',
};

// Notebook, sources and chat are fetched in the browser: apiFetch needs the session's access
// token. Only the shape of the ID can be checked here, which spares the API requests that must fail.
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
        <ChatPanel notebookId={id} />
      </div>
    </div>
  );
}
