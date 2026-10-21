import type { SourceStatus } from '@notebooklm/shared';
import { CircleAlert, CircleCheck, Clock, LoaderCircle, type LucideIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

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

interface SourceStatusBadgeProps {
  status: SourceStatus;
}

export function SourceStatusBadge({ status }: SourceStatusBadgeProps) {
  const { label, icon: Icon, variant, className, iconClassName } = STATUS_APPEARANCE[status];
  return (
    <Badge variant={variant} className={className}>
      <Icon aria-hidden="true" data-icon="inline-start" className={iconClassName} />
      <span className="sr-only">Status: </span>
      {label}
    </Badge>
  );
}
