import type { SourceStatus } from '@notebooklm/shared';
import { CircleAlert, CircleCheck, Clock, LoaderCircle, type LucideIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface StatusAppearance {
  label: string;
  icon: LucideIcon;
  variant: 'outline' | 'secondary' | 'destructive';
  className?: string;
  iconClassName?: string;
}

const STATUS_APPEARANCE: Record<SourceStatus, StatusAppearance> = {
  pending: { label: 'wartet', icon: Clock, variant: 'outline', className: 'text-muted-foreground' },
  processing: {
    label: 'wird verarbeitet',
    icon: LoaderCircle,
    variant: 'secondary',
    iconClassName: 'animate-spin motion-reduce:animate-none',
  },
  ready: {
    label: 'bereit',
    icon: CircleCheck,
    variant: 'secondary',
    className: 'bg-primary-soft text-primary-soft-foreground',
  },
  failed: { label: 'fehlgeschlagen', icon: CircleAlert, variant: 'destructive' },
};

/** Shown when the API marks a source as failed without giving a reason. */
const FALLBACK_FAILURE_REASON = 'Die Quelle konnte nicht verarbeitet werden.';
const RETRY_HINT = 'Bitte lösche die Quelle und lade sie erneut hoch.';

interface SourceStatusBadgeProps {
  status: SourceStatus;
  /** Failure reason from the API; only shown for failed sources. */
  error?: string | null;
}

export function SourceStatusBadge({ status, error }: SourceStatusBadgeProps) {
  const { label, icon: Icon, variant, className, iconClassName } = STATUS_APPEARANCE[status];
  const content = (
    <>
      <Icon aria-hidden="true" data-icon="inline-start" className={iconClassName} />
      <span className="sr-only">Status: </span>
      {label}
    </>
  );

  if (status !== 'failed') {
    return (
      <Badge variant={variant} className={className}>
        {content}
      </Badge>
    );
  }

  // The badge becomes a button so keyboard users can focus it and read the reason as well.
  // The local provider keeps the badge usable outside the app layout, e.g. in isolated tests;
  // nesting it inside the root provider is supported by Radix.
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge asChild variant={variant} className={className}>
            <button type="button" className="cursor-help">
              {content}
            </button>
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="bottom" align="start" className="flex-col items-start">
          <p>{error?.trim() || FALLBACK_FAILURE_REASON}</p>
          <p>{RETRY_HINT}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
