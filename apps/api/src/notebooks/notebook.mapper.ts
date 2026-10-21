import type { Notebook } from '@notebooklm/shared';
import type { NotebookRecord } from './notebooks.repository';

/**
 * Maps a stored notebook to the API contract. Dates leave the API as UTC ISO
 * strings with `Z` (`toISOString()`), the only form `NotebookSchema` accepts.
 */
export function toNotebook(record: NotebookRecord): Notebook {
  return {
    id: record.id,
    title: record.title,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    sourceCount: record.sourceCount,
  };
}
