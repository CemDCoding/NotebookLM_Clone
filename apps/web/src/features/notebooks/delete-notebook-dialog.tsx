'use client';

import type { Notebook } from '@notebooklm/shared';
import { useState, type MouseEvent } from 'react';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toErrorMessage } from './to-error-message';
import { useDeleteNotebook } from './use-notebooks';

interface DeleteNotebookDialogProps {
  notebook: Pick<Notebook, 'id' | 'title'>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCloseAutoFocus?: (event: Event) => void;
}

export function DeleteNotebookDialog({
  notebook,
  open,
  onOpenChange,
  onCloseAutoFocus,
}: DeleteNotebookDialogProps) {
  const deleteNotebook = useDeleteNotebook();
  const [error, setError] = useState<string | null>(null);
  const isPending = deleteNotebook.isPending;

  function handleOpenChange(nextOpen: boolean) {
    if (isPending) {
      return;
    }
    setError(null);
    onOpenChange(nextOpen);
  }

  async function handleConfirm(event: MouseEvent<HTMLButtonElement>) {
    // The action would close the dialog at once; it stays open until the API has answered.
    event.preventDefault();
    setError(null);
    try {
      await deleteNotebook.mutateAsync(notebook.id);
    } catch (deleteError) {
      setError(toErrorMessage(deleteError));
      return;
    }
    onOpenChange(false);
    toast.success('Notebook gelöscht.');
  }

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent onCloseAutoFocus={onCloseAutoFocus}>
        <AlertDialogHeader>
          <AlertDialogTitle>Notebook löschen?</AlertDialogTitle>
          <AlertDialogDescription>
            „{notebook.title}“ wird mit allen Quellen und dem Chatverlauf endgültig gelöscht. Das
            lässt sich nicht rückgängig machen.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Abbrechen</AlertDialogCancel>
          <AlertDialogAction variant="destructive" disabled={isPending} onClick={handleConfirm}>
            {isPending ? 'Wird gelöscht …' : 'Löschen'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
