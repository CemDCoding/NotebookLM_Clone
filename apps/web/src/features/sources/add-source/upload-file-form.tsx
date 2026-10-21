'use client';

import { ACCEPTED_UPLOAD_EXTENSIONS } from '@notebooklm/shared';
import { cn } from 'cn';
import { FileUp } from 'lucide-react';
import { useId, useState, type ChangeEvent, type DragEvent, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { DialogClose, DialogFooter } from '@/components/ui/dialog';
import { toErrorMessage } from '@/features/notebooks/to-error-message';
import { MAX_FILE_SIZE_LABEL, validateUploadFile } from './validate-upload-file';

interface UploadFileFormProps {
  isPending: boolean;
  /** Uploads the checked file. A rejected promise keeps the form open and shows the error. */
  onSubmit: (file: File) => Promise<void>;
}

function formatFileSize(bytes: number): string {
  const format = (value: number) => value.toLocaleString('de-DE', { maximumFractionDigits: 1 });
  if (bytes < 1024 * 1024) {
    return `${format(Math.max(bytes / 1024, 0.1))} KB`;
  }
  return `${format(bytes / (1024 * 1024))} MB`;
}

/** File picker with a drop zone; size and extension are checked before anything is sent. */
export function UploadFileForm({ isPending, onSubmit }: UploadFileFormProps) {
  const inputId = useId();
  const hintId = useId();
  const errorId = useId();
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  function selectFile(files: FileList | null) {
    const candidate = files?.[0];
    if (!candidate) {
      return;
    }
    if (files.length > 1) {
      setFile(null);
      setError('Bitte lade jeweils nur eine Datei hoch.');
      return;
    }
    const problem = validateUploadFile(candidate);
    setFile(problem ? null : candidate);
    setError(problem);
  }

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    selectFile(event.target.files);
    // Cleared so choosing the same file again after an error still fires a change.
    event.target.value = '';
  }

  function handleDragOver(event: DragEvent<HTMLDivElement>) {
    // Without this the browser would open the dropped file instead of handing it to the page.
    event.preventDefault();
    if (!isPending) {
      setIsDragging(true);
    }
  }

  function handleDragLeave(event: DragEvent<HTMLDivElement>) {
    // Moving over a child element also fires dragleave; only leaving the zone itself counts.
    if (!(
      event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget)
    )) {
      setIsDragging(false);
    }
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);
    if (!isPending) {
      selectFile(event.dataTransfer.files);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // The submit button is disabled until a valid file is chosen.
    if (!file) {
      return;
    }
    setError(null);
    try {
      await onSubmit(file);
    } catch (submitError) {
      setError(toErrorMessage(submitError));
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          'flex flex-col items-center gap-3 rounded-lg border border-dashed px-4 py-8 text-center transition-colors',
          isDragging && 'border-primary bg-primary-soft',
        )}
      >
        <span className="flex size-10 items-center justify-center rounded-xl border bg-primary-soft text-primary-soft-foreground">
          <FileUp aria-hidden="true" className="size-5" />
        </span>
        <p className="text-sm text-muted-foreground">Datei hierher ziehen oder</p>
        <input
          id={inputId}
          type="file"
          accept={ACCEPTED_UPLOAD_EXTENSIONS.join(',')}
          onChange={handleChange}
          disabled={isPending}
          aria-describedby={error ? `${hintId} ${errorId}` : hintId}
          aria-invalid={error ? true : undefined}
          className="peer sr-only"
        />
        {/* The label acts as the visible button; the native input stays reachable by keyboard. */}
        <label
          htmlFor={inputId}
          className="inline-flex h-8 cursor-pointer items-center rounded-lg border border-border bg-background px-2.5 text-sm font-medium transition-colors peer-focus-visible:border-ring peer-focus-visible:ring-3 peer-focus-visible:ring-ring/50 peer-disabled:pointer-events-none peer-disabled:opacity-50 hover:bg-muted"
        >
          Datei auswählen
        </label>
        <p id={hintId} className="text-xs text-muted-foreground">
          PDF, TXT oder Markdown, höchstens {MAX_FILE_SIZE_LABEL}.
        </p>
      </div>
      {file && (
        <p className="flex min-w-0 items-baseline gap-2 text-sm">
          <span title={file.name} className="truncate font-medium">
            {file.name}
          </span>
          <span className="shrink-0 text-muted-foreground">{formatFileSize(file.size)}</span>
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="outline" disabled={isPending}>
            Abbrechen
          </Button>
        </DialogClose>
        <Button type="submit" disabled={isPending || !file}>
          {isPending ? 'Wird hochgeladen …' : 'Hochladen'}
        </Button>
      </DialogFooter>
    </form>
  );
}
