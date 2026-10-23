import type { Metadata } from 'next';
import { CreateNotebookButton } from '@/features/notebooks/create-notebook-button';
import { NotebookOverview } from '@/features/notebooks/notebook-overview';

export const metadata: Metadata = {
  title: 'Notebooks',
};

// The list is fetched in the browser: apiFetch needs the session's access token, and
// TanStack Query keeps it fresh after every change.
export default function NotebooksPage() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-10">
      <div className="flex items-end justify-between gap-6">
        <div className="flex flex-col gap-1">
          <h1 className="font-heading text-3xl font-semibold tracking-tight">
            Deine <span className="font-serif font-normal italic">Notebooks</span>
          </h1>
          <p className="text-muted-foreground">
            Sammle Quellen zu einem Thema und stell Fragen dazu.
          </p>
        </div>
        <CreateNotebookButton />
      </div>
      <NotebookOverview />
    </div>
  );
}
