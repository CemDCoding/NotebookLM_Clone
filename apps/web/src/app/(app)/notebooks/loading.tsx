import { Skeleton } from '@/components/ui/skeleton';
import { NotebookGridSkeleton } from '@/features/notebooks/notebook-grid-skeleton';

export default function NotebooksLoading() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-10">
      <div aria-hidden="true" className="flex flex-col gap-2">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-5 w-96" />
      </div>
      <NotebookGridSkeleton />
    </div>
  );
}
