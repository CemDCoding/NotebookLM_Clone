'use client';

import type { CreatePastedSourceRequest } from '@notebooklm/shared';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PasteTextForm } from './paste-text-form';
import { UploadFileForm } from './upload-file-form';
import { useAddPastedSource, useUploadSource } from './use-add-source';

interface AddSourceDialogProps {
  notebookId: string;
}

/** Button „Quelle hinzufügen“ with a dialog to upload a file or paste text. */
export function AddSourceDialog({ notebookId }: AddSourceDialogProps) {
  const [open, setOpen] = useState(false);
  const uploadSource = useUploadSource(notebookId);
  const addPastedSource = useAddPastedSource(notebookId);
  const isPending = uploadSource.isPending || addPastedSource.isPending;

  function handleOpenChange(nextOpen: boolean) {
    // Closing mid-request would hide the outcome of an upload that still happens.
    if (!isPending) {
      setOpen(nextOpen);
    }
  }

  async function handleUpload(file: File) {
    await uploadSource.mutateAsync(file);
    setOpen(false);
    toast.success('Quelle hinzugefügt.');
  }

  async function handlePaste(request: CreatePastedSourceRequest) {
    await addPastedSource.mutateAsync(request);
    setOpen(false);
    toast.success('Quelle hinzugefügt.');
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus aria-hidden="true" data-icon="inline-start" />
          Quelle hinzufügen
        </Button>
      </DialogTrigger>
      <DialogContent showCloseButton={false} className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Quelle hinzufügen</DialogTitle>
          <DialogDescription>
            Lade eine Datei hoch oder füge Text ein. Der Assistent antwortet nur auf Grundlage
            deiner Quellen.
          </DialogDescription>
        </DialogHeader>
        {/* Mounted only while open, so every opening starts with empty forms and no errors. */}
        <Tabs defaultValue="file">
          <TabsList className="w-full">
            <TabsTrigger value="file" disabled={isPending}>
              Datei
            </TabsTrigger>
            <TabsTrigger value="text" disabled={isPending}>
              Text einfügen
            </TabsTrigger>
          </TabsList>
          <TabsContent value="file" className="pt-2">
            <UploadFileForm isPending={uploadSource.isPending} onSubmit={handleUpload} />
          </TabsContent>
          <TabsContent value="text" className="pt-2">
            <PasteTextForm isPending={addPastedSource.isPending} onSubmit={handlePaste} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
