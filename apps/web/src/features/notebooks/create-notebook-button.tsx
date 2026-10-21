'use client';

import { Plus } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { NotebookTitleDialog } from './notebook-title-dialog';
import { useCreateNotebook } from './use-notebooks';

export function CreateNotebookButton() {
  const [open, setOpen] = useState(false);
  const createNotebook = useCreateNotebook();

  async function handleSubmit(title: string) {
    await createNotebook.mutateAsync({ title });
    toast.success('Notebook angelegt.');
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus aria-hidden="true" data-icon="inline-start" />
        Neues Notebook
      </Button>
      <NotebookTitleDialog
        open={open}
        onOpenChange={setOpen}
        heading="Neues Notebook"
        description="Gib deinem Notebook einen Titel. Du kannst ihn später ändern."
        submitLabel="Anlegen"
        pendingLabel="Wird angelegt …"
        onSubmit={handleSubmit}
      />
    </>
  );
}
