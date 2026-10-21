import { z } from 'zod';
import { DEFAULT_LIMITS } from './limits';

export const SOURCE_TITLE_MAX_LENGTH = 200;

// The extension only distinguishes text from markdown; the API detects the
// actual file type from the content (PE-15). The web app uses this list for
// the file picker's `accept` attribute.
export const ACCEPTED_UPLOAD_EXTENSIONS = ['.pdf', '.txt', '.md', '.markdown'] as const;

export const SourceTypeSchema = z.enum(['pdf', 'text', 'markdown', 'pasted']);

export const SourceStatusSchema = z.enum(['pending', 'processing', 'ready', 'failed']);

export const SourceSchema = z.object({
  id: z.uuid(),
  notebookId: z.uuid(),
  type: SourceTypeSchema,
  title: z.string(),
  status: SourceStatusSchema,
  error: z.string().nullable(),
  isActive: z.boolean(),
  createdAt: z.iso.datetime(),
});

export const SourceListResponseSchema = z.object({
  sources: z.array(SourceSchema),
});

// The text is stored as given, so it is not trimmed. A whitespace-only text is
// still rejected because it can never produce a citable passage. The length
// counts UTF-16 code units (String.length), which equals characters for all
// common German text.
const PastedTextSchema = z
  .string()
  .min(1)
  .max(DEFAULT_LIMITS.maxPastedTextChars)
  .refine((text) => text.trim().length > 0, { message: 'Text must not be blank' });

export const CreatePastedSourceRequestSchema = z.object({
  title: z.string().trim().min(1).max(SOURCE_TITLE_MAX_LENGTH),
  text: PastedTextSchema,
});

export const UpdateSourceRequestSchema = z.object({
  isActive: z.boolean(),
});

// Matches the route `/notebooks/:id/sources/:sourceId` (PE-07).
export const SourceParamsSchema = z.object({
  id: z.uuid(),
  sourceId: z.uuid(),
});

export type AcceptedUploadExtension = (typeof ACCEPTED_UPLOAD_EXTENSIONS)[number];
export type SourceType = z.infer<typeof SourceTypeSchema>;
export type SourceStatus = z.infer<typeof SourceStatusSchema>;
export type Source = z.infer<typeof SourceSchema>;
export type SourceListResponse = z.infer<typeof SourceListResponseSchema>;
export type CreatePastedSourceRequest = z.infer<typeof CreatePastedSourceRequestSchema>;
export type UpdateSourceRequest = z.infer<typeof UpdateSourceRequestSchema>;
export type SourceParams = z.infer<typeof SourceParamsSchema>;
