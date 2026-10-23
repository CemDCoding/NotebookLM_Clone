import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface RouteStatusProps {
  icon: LucideIcon;
  /** `destructive` marks a failure, `default` a page that simply does not exist. */
  tone?: 'default' | 'destructive';
  title: string;
  description: ReactNode;
  /** Ways out, e.g. a retry button or a link back. */
  children?: ReactNode;
}

/**
 * Body of the route-level error and not-found pages. They replace the whole page, so the title
 * is the page's `h1`. The private `_components` folder keeps it out of the routing.
 */
export function RouteStatus({
  icon: Icon,
  tone = 'default',
  title,
  description,
  children,
}: RouteStatusProps) {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col items-center justify-center gap-4 px-6 py-16 text-center">
      <span
        className={cn(
          'flex size-12 items-center justify-center rounded-xl border',
          tone === 'destructive'
            ? 'border-destructive/30 bg-destructive/5 text-destructive'
            : 'bg-primary-soft text-primary-soft-foreground',
        )}
      >
        <Icon aria-hidden="true" className="size-6" />
      </span>
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">{title}</h1>
        <div className="max-w-md text-muted-foreground">{description}</div>
      </div>
      {children && <div className="flex flex-wrap justify-center gap-3">{children}</div>}
    </div>
  );
}
