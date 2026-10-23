import { Skeleton } from '@/components/ui/skeleton';

const PLACEHOLDER_COUNT = 4;

/** Placeholder of the source list, shared by the route's loading UI and the first fetch. */
export function SourceListSkeleton() {
  return (
    <div role="status" aria-label="Quellen werden geladen">
      <ul aria-hidden="true" className="flex flex-col gap-1">
        {Array.from({ length: PLACEHOLDER_COUNT }, (_, index) => (
          <li key={index} className="flex items-start gap-3 px-2 py-2.5">
            <Skeleton className="size-8 rounded-lg" />
            <div className="flex flex-1 flex-col gap-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-16 rounded-4xl" />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
