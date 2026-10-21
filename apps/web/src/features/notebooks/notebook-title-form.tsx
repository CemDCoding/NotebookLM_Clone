'use client';

import { useId, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { DialogClose, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toErrorMessage } from './to-error-message';
import { validateNotebookTitle } from './validate-notebook-title';

interface NotebookTitleFormProps {
  initialTitle: string;
  submitLabel: string;
  pendingLabel: string;
  isPending: boolean;
  onSubmit: (title: string) => Promise<void>;
}

/** Title field with validation; errors of `onSubmit` are shown below the field. */
export function NotebookTitleForm({
  initialTitle,
  submitLabel,
  pendingLabel,
  isPending,
  onSubmit,
}: NotebookTitleFormProps) {
  const inputId = useId();
  const errorId = useId();
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = new FormData(event.currentTarget).get('title');
    const validation = validateNotebookTitle(typeof value === 'string' ? value : '');
    if (!validation.success) {
      setError(validation.error);
      return;
    }

    setError(null);
    try {
      await onSubmit(validation.title);
    } catch (submitError) {
      setError(toErrorMessage(submitError));
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor={inputId}>Titel</Label>
        <Input
          id={inputId}
          name="title"
          defaultValue={initialTitle}
          autoComplete="off"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
        />
        {error && (
          <p id={errorId} role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </div>
      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="outline" disabled={isPending}>
            Abbrechen
          </Button>
        </DialogClose>
        <Button type="submit" disabled={isPending}>
          {isPending ? pendingLabel : submitLabel}
        </Button>
      </DialogFooter>
    </form>
  );
}
