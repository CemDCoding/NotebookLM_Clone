'use client';

import type { Source } from '@notebooklm/shared';
import { cn } from 'cn';
import { EllipsisVertical, Trash2 } from 'lucide-react';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Switch } from '@/components/ui/switch';
import { toErrorMessage } from '@/features/notebooks/to-error-message';
import { DeleteSourceDialog } from './delete-source-dialog';
import { SourceStatusBadge } from './source-status-badge';
import { SourceTypeIcon } from './source-type-icon';
import { useToggleSource } from './use-sources';

interface SourceItemProps {
  notebookId: string;
  source: Source;
}

export function SourceItem({ notebookId, source }: SourceItemProps) {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const menuTriggerRef = useRef<HTMLButtonElement>(null);
  const toggleSource = useToggleSource(notebookId);

  function handleToggle(isActive: boolean) {
    toggleSource.mutate(
      { sourceId: source.id, isActive },
      {
        onError: (error) =>
          toast.error(
            `„${source.title}“ konnte nicht ${isActive ? 'aktiviert' : 'deaktiviert'} werden. ${toErrorMessage(error)}`,
          ),
      },
    );
  }

  // The dialog is opened from the menu, which is gone by the time it closes; without this
  // keyboard users would land at the top of the page.
  function returnFocusToMenu(event: Event) {
    event.preventDefault();
    menuTriggerRef.current?.focus();
  }

  return (
    <li className="flex items-start gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-muted">
      <SourceTypeIcon type={source.type} />
      <div className="flex min-w-0 flex-1 flex-col items-start gap-1.5">
        {/* Long file names are cut off; the native tooltip still shows the full title. */}
        <p
          title={source.title}
          className={cn(
            'w-full truncate text-sm leading-tight font-medium',
            !source.isActive && 'text-muted-foreground',
          )}
        >
          {source.title}
        </p>
        <SourceStatusBadge status={source.status} error={source.error} />
      </div>
      <Switch
        size="sm"
        className="mt-1.5"
        checked={source.isActive}
        onCheckedChange={handleToggle}
        aria-label={`„${source.title}“ im Chat verwenden`}
      />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            ref={menuTriggerRef}
            variant="ghost"
            size="icon-sm"
            className="-mr-1"
            aria-label={`Aktionen für „${source.title}“`}
          >
            <EllipsisVertical aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem variant="destructive" onSelect={() => setDeleteOpen(true)}>
            <Trash2 aria-hidden="true" />
            Löschen
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <DeleteSourceDialog
        notebookId={notebookId}
        source={source}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onCloseAutoFocus={returnFocusToMenu}
      />
    </li>
  );
}
