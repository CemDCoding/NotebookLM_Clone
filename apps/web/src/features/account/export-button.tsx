'use client';

import { Download } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { toErrorMessage } from '@/features/notebooks/to-error-message';
import { fetchExportFile, saveFile } from './export-file';

export function ExportButton() {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleExport() {
    setIsPending(true);
    setError(null);
    try {
      saveFile(await fetchExportFile());
      toast.success('Dein Export wurde heruntergeladen.');
    } catch (exportError) {
      setError(toErrorMessage(exportError));
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-3">
      <Button onClick={handleExport} disabled={isPending}>
        <Download aria-hidden="true" data-icon="inline-start" />
        {isPending ? 'Export wird erstellt …' : 'Meine Daten exportieren'}
      </Button>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
