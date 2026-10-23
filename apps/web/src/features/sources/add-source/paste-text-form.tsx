'use client';

import {
  DEFAULT_LIMITS,
  SOURCE_TITLE_MAX_LENGTH,
  type CreatePastedSourceRequest,
} from '@notebooklm/shared';
import { cn } from 'cn';
import { useId, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { DialogClose, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toErrorMessage } from '@/features/notebooks/to-error-message';

const MAX_CHARS = DEFAULT_LIMITS.maxPastedTextChars;

function formatCount(value: number): string {
  return value.toLocaleString('de-DE');
}

interface FieldErrors {
  title?: string;
  text?: string;
}

interface PasteTextFormProps {
  isPending: boolean;
  /** Saves the pasted text. A rejected promise keeps the form open and shows the error. */
  onSubmit: (request: CreatePastedSourceRequest) => Promise<void>;
}

/** Title and text field with a live character counter; over the limit nothing can be sent. */
export function PasteTextForm({ isPending, onSubmit }: PasteTextFormProps) {
  const titleId = useId();
  const titleErrorId = useId();
  const textId = useId();
  const counterId = useId();
  const textErrorId = useId();
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  // String.length, the same count the shared schema and the API use.
  const isTooLong = text.length > MAX_CHARS;
  const textError = isTooLong
    ? `Der Text ist zu lang. Bitte kürze ihn auf höchstens ${formatCount(MAX_CHARS)} Zeichen.`
    : fieldErrors.text;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isTooLong) {
      return;
    }
    const trimmedTitle = title.trim();
    const errors: FieldErrors = {};
    if (trimmedTitle.length === 0) {
      errors.title = 'Bitte gib einen Titel ein.';
    }
    if (text.trim().length === 0) {
      errors.text = 'Bitte füge einen Text ein.';
    }
    setFieldErrors(errors);
    setSubmitError(null);
    if (errors.title || errors.text) {
      return;
    }

    try {
      // The text is sent as given; only the title is trimmed, like the shared schema does.
      await onSubmit({ title: trimmedTitle, text });
    } catch (error) {
      setSubmitError(toErrorMessage(error));
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor={titleId}>Titel</Label>
        <Input
          id={titleId}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          maxLength={SOURCE_TITLE_MAX_LENGTH}
          autoComplete="off"
          disabled={isPending}
          aria-invalid={fieldErrors.title ? true : undefined}
          aria-describedby={fieldErrors.title ? titleErrorId : undefined}
        />
        {fieldErrors.title && (
          <p id={titleErrorId} role="alert" className="text-sm text-destructive">
            {fieldErrors.title}
          </p>
        )}
      </div>
      <div className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between gap-2">
          <Label htmlFor={textId}>Text</Label>
          <span
            id={counterId}
            className={cn(
              'text-xs tabular-nums text-muted-foreground',
              isTooLong && 'font-medium text-destructive',
            )}
          >
            {formatCount(text.length)} / {formatCount(MAX_CHARS)}
            <span className="sr-only"> Zeichen</span>
          </span>
        </div>
        <Textarea
          id={textId}
          value={text}
          onChange={(event) => setText(event.target.value)}
          disabled={isPending}
          aria-invalid={textError ? true : undefined}
          aria-describedby={textError ? `${counterId} ${textErrorId}` : counterId}
          // The field grows with its content up to this height and scrolls beyond it.
          className="max-h-72 min-h-40 overflow-y-auto"
        />
        {textError && (
          <p id={textErrorId} role="alert" className="text-sm text-destructive">
            {textError}
          </p>
        )}
      </div>
      {submitError && (
        <p role="alert" className="text-sm text-destructive">
          {submitError}
        </p>
      )}
      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="outline" disabled={isPending}>
            Abbrechen
          </Button>
        </DialogClose>
        <Button type="submit" disabled={isPending || isTooLong}>
          {isPending ? 'Wird hinzugefügt …' : 'Hinzufügen'}
        </Button>
      </DialogFooter>
    </form>
  );
}
