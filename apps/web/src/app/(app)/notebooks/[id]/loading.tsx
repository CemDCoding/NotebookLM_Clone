import { Skeleton } from '@/components/ui/skeleton';
import { SourceListSkeleton } from '@/features/sources/source-list-skeleton';

export default function NotebookLoading() {
  return (
    <div className="flex w-full flex-1 flex-col gap-6 px-6 py-6">
      <div aria-hidden="true" className="flex flex-col gap-2">
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-9 w-80" />
      </div>
      <div className="grid flex-1 grid-cols-[20rem_minmax(0,1fr)] items-start gap-6">
        <div className="flex flex-col gap-4 rounded-xl border bg-card p-4">
          <Skeleton aria-hidden="true" className="mx-2 h-6 w-24" />
          <SourceListSkeleton />
        </div>
        <div aria-hidden="true" className="min-h-96 self-stretch rounded-xl border bg-card" />
      </div>
    </div>
  );
}
