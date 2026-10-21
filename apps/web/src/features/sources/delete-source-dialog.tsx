'use client';

import type { Source } from '@notebooklm/shared';
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
import { toErrorMessage } from '@/features/notebooks/to-error-message';
import { useDeleteSource } from './use-sources';

interface DeleteSourceDialogProps {
  notebookId: string;
  source: Pick<Source, 'id' | 'title'>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCloseAutoFocus?: (event: Event) => void;
}

export function DeleteSourceDialog({
  notebookId,
  source,
  open,
  onOpenChange,
  onCloseAutoFocus,
}: DeleteSourceDialogProps) {
  const deleteSource = useDeleteSource(notebookId);
  const [error, setError] = useState<string | null>(null);
  const isPending = deleteSource.isPending;

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
      await deleteSource.mutateAsync(source.id);
    } catch (deleteError) {
      setError(toErrorMessage(deleteError));
      return;
    }
    onOpenChange(false);
    toast.success('Quelle gelöscht.');
  }

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent onCloseAutoFocus={onCloseAutoFocus}>
        <AlertDialogHeader>
          <AlertDialogTitle>Quelle löschen?</AlertDialogTitle>
          <AlertDialogDescription>
            „{source.title}“ wird mit der Datei und allen daraus erzeugten Abschnitten endgültig
            gelöscht. Das lässt sich nicht rückgängig machen.
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
