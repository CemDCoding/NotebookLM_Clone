import { z } from 'zod';
import { MessageRoleSchema, StoredCitationSchema } from './chat';
import { NotebookSchema } from './notebooks';
import { SourceSchema } from './sources';

// Data portability (GDPR Art. 20). The export carries metadata and the user's
// own chat only: no chunks, file contents or embeddings. Citations are the
// stored references, never source text, so the export leaks nothing of a
// source beyond its title. Objects strip unknown keys on parse, so a content
// field added by mistake upstream cannot slip into the download.

export const ExportSourceSchema = SourceSchema.omit({ notebookId: true });

export const ExportMessageSchema = z.object({
  id: z.uuid(),
  role: MessageRoleSchema,
  content: z.string(),
  model: z.string().nullable(),
  citations: z.array(StoredCitationSchema),
  createdAt: z.iso.datetime(),
});

export const ExportNotebookSchema = NotebookSchema.omit({ sourceCount: true }).extend({
  sources: z.array(ExportSourceSchema),
  messages: z.array(ExportMessageSchema),
});

export const ExportSchema = z.object({
  exportedAt: z.iso.datetime(),
  userId: z.uuid(),
  notebooks: z.array(ExportNotebookSchema),
});

export type ExportSource = z.infer<typeof ExportSourceSchema>;
export type ExportMessage = z.infer<typeof ExportMessageSchema>;
export type ExportNotebook = z.infer<typeof ExportNotebookSchema>;
export type DataExport = z.infer<typeof ExportSchema>;
