import { Skeleton } from '@/components/ui/skeleton';

const PLACEHOLDER_COUNT = 6;

/** Placeholder of the notebook grid, shared by the route's loading UI and the first fetch. */
export function NotebookGridSkeleton() {
  return (
    <div role="status" aria-label="Notebooks werden geladen">
      <ul aria-hidden="true" className="grid grid-cols-3 gap-4">
        {Array.from({ length: PLACEHOLDER_COUNT }, (_, index) => (
          <li
            key={index}
            className="flex min-h-36 flex-col justify-between gap-6 rounded-xl border bg-card p-5"
          >
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </li>
        ))}
      </ul>
    </div>
  );
}
