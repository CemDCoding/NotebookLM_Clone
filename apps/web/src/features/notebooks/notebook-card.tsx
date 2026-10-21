'use client';

import type { Notebook } from '@notebooklm/shared';
import { EllipsisVertical, Pencil, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { NOTEBOOKS_PATH } from '@/lib/supabase/route-access';
import { DeleteNotebookDialog } from './delete-notebook-dialog';
import { formatNotebookDate, formatSourceCount } from './format';
import { NotebookTitleDialog } from './notebook-title-dialog';
import { useRenameNotebook } from './use-notebooks';

interface NotebookCardProps {
  notebook: Notebook;
}

type OpenDialog = 'rename' | 'delete' | null;

export function NotebookCard({ notebook }: NotebookCardProps) {
  const [openDialog, setOpenDialog] = useState<OpenDialog>(null);
  const menuTriggerRef = useRef<HTMLButtonElement>(null);
  const renameNotebook = useRenameNotebook();

  async function handleRename(title: string) {
    await renameNotebook.mutateAsync({ id: notebook.id, title });
    toast.success('Notebook umbenannt.');
  }

  function closeDialog(open: boolean) {
    if (!open) {
      setOpenDialog(null);
    }
  }

  // The dialogs are opened from the menu, which is gone by the time they close; without this
  // keyboard users would land at the top of the page.
  function returnFocusToMenu(event: Event) {
    event.preventDefault();
    menuTriggerRef.current?.focus();
  }

  return (
    <li className="relative flex min-h-36 flex-col justify-between gap-6 rounded-xl border bg-card p-5 transition-colors hover:border-primary/40 has-[a:focus-visible]:border-ring has-[a:focus-visible]:ring-3 has-[a:focus-visible]:ring-ring/50">
      <div className="flex items-start justify-between gap-3">
        <h2 className="font-heading text-base leading-snug font-medium break-words">
          {/* The link covers the whole card; the menu button sits above it. */}
          <Link
            href={`${NOTEBOOKS_PATH}/${notebook.id}`}
            className="outline-none after:absolute after:inset-0 after:rounded-xl"
          >
            {notebook.title}
          </Link>
        </h2>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              ref={menuTriggerRef}
              variant="ghost"
              size="icon-sm"
              className="relative z-10 -mt-1 -mr-2"
              aria-label={`Aktionen für „${notebook.title}“`}
            >
              <EllipsisVertical aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => setOpenDialog('rename')}>
              <Pencil aria-hidden="true" />
              Umbenennen
            </DropdownMenuItem>
            <DropdownMenuItem variant="destructive" onSelect={() => setOpenDialog('delete')}>
              <Trash2 aria-hidden="true" />
              Löschen
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <p className="text-sm text-muted-foreground">
        {formatSourceCount(notebook.sourceCount)} · Geändert am{' '}
        <time dateTime={notebook.updatedAt}>{formatNotebookDate(notebook.updatedAt)}</time>
      </p>

      <NotebookTitleDialog
        open={openDialog === 'rename'}
        onOpenChange={closeDialog}
        heading="Notebook umbenennen"
        description="Gib einen neuen Titel ein."
        submitLabel="Speichern"
        pendingLabel="Wird gespeichert …"
        initialTitle={notebook.title}
        onSubmit={handleRename}
        onCloseAutoFocus={returnFocusToMenu}
      />
      <DeleteNotebookDialog
        notebook={notebook}
        open={openDialog === 'delete'}
        onOpenChange={closeDialog}
        onCloseAutoFocus={returnFocusToMenu}
      />
    </li>
  );
}
