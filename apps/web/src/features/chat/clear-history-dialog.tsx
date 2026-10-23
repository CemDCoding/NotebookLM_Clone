'use client';

import { Trash2 } from 'lucide-react';
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
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { toErrorMessage } from '@/features/notebooks/to-error-message';
import { useClearMessages } from './queries';

interface ClearHistoryDialogProps {
  notebookId: string;
  disabled?: boolean;
  /** Called once the API has deleted the history. */
  onCleared?: () => void;
}

export function ClearHistoryDialog({ notebookId, disabled, onCleared }: ClearHistoryDialogProps) {
  const clearMessages = useClearMessages(notebookId);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isPending = clearMessages.isPending;

  function handleOpenChange(nextOpen: boolean) {
    if (isPending) {
      return;
    }
    setError(null);
    setOpen(nextOpen);
  }

  async function handleConfirm(event: MouseEvent<HTMLButtonElement>) {
    // The action would close the dialog at once; it stays open until the API has answered.
    event.preventDefault();
    setError(null);
    try {
      await clearMessages.mutateAsync();
    } catch (clearError) {
      setError(toErrorMessage(clearError));
      return;
    }
    setOpen(false);
    onCleared?.();
    toast.success('Chatverlauf gelöscht.');
  }

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="sm" disabled={disabled} className="text-muted-foreground">
          <Trash2 aria-hidden="true" data-icon="inline-start" />
          Verlauf löschen
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Chatverlauf löschen?</AlertDialogTitle>
          <AlertDialogDescription>
            Alle Fragen und Antworten dieses Notebooks werden endgültig gelöscht. Deine Quellen
            bleiben erhalten. Das lässt sich nicht rückgängig machen.
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
