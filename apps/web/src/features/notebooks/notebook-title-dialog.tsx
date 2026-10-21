'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { NotebookTitleForm } from './notebook-title-form';

interface NotebookTitleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  heading: string;
  description: string;
  submitLabel: string;
  pendingLabel: string;
  initialTitle?: string;
  /** Saves the validated title. A rejected promise keeps the dialog open and shows the error. */
  onSubmit: (title: string) => Promise<void>;
  /** Where focus goes after closing, needed when the dialog was opened from a menu. */
  onCloseAutoFocus?: (event: Event) => void;
}

/** Dialog with a single title field, used to create and to rename a notebook. */
export function NotebookTitleDialog({
  open,
  onOpenChange,
  heading,
  description,
  submitLabel,
  pendingLabel,
  initialTitle = '',
  onSubmit,
  onCloseAutoFocus,
}: NotebookTitleDialogProps) {
  const [isPending, setIsPending] = useState(false);

  function handleOpenChange(nextOpen: boolean) {
    // Closing mid-request would hide the outcome of a change that still happens.
    if (!isPending) {
      onOpenChange(nextOpen);
    }
  }

  async function handleSubmit(title: string) {
    setIsPending(true);
    try {
      await onSubmit(title);
      onOpenChange(false);
    } finally {
      setIsPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent showCloseButton={false} onCloseAutoFocus={onCloseAutoFocus}>
        <DialogHeader>
          <DialogTitle>{heading}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {/* Mounted only while open, so every opening starts with a fresh field and no error. */}
        <NotebookTitleForm
          initialTitle={initialTitle}
          submitLabel={submitLabel}
          pendingLabel={pendingLabel}
          isPending={isPending}
          onSubmit={handleSubmit}
        />
      </DialogContent>
    </Dialog>
  );
}
