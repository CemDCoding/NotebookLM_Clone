import { z } from 'zod';

export const NOTEBOOK_TITLE_MAX_LENGTH = 200;

// Trim before the length checks so a whitespace-only title counts as empty.
const NotebookTitleSchema = z.string().trim().min(1).max(NOTEBOOK_TITLE_MAX_LENGTH);

export const NotebookSchema = z.object({
  id: z.uuid(),
  title: z.string(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  sourceCount: z.number().int().nonnegative(),
});

export const NotebookListResponseSchema = z.object({
  notebooks: z.array(NotebookSchema),
});

export const CreateNotebookRequestSchema = z.object({
  title: NotebookTitleSchema,
});

export const RenameNotebookRequestSchema = z.object({
  title: NotebookTitleSchema,
});

export const NotebookIdParamsSchema = z.object({
  id: z.uuid(),
});

export type Notebook = z.infer<typeof NotebookSchema>;
export type NotebookListResponse = z.infer<typeof NotebookListResponseSchema>;
export type CreateNotebookRequest = z.infer<typeof CreateNotebookRequestSchema>;
export type RenameNotebookRequest = z.infer<typeof RenameNotebookRequestSchema>;
export type NotebookIdParams = z.infer<typeof NotebookIdParamsSchema>;
