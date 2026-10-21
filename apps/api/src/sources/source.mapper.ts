import type { Source } from '@notebooklm/shared';
import type { SourceRecord } from './sources.repository';

/**
 * Maps a stored source to the API contract. Dates leave the API as UTC ISO
 * strings with `Z` (`toISOString()`), the only form `SourceSchema` accepts.
 */
export function toSource(record: SourceRecord): Source {
  return {
    id: record.id,
    notebookId: record.notebookId,
    type: record.type,
    title: record.title,
    status: record.status,
    error: record.error,
    isActive: record.isActive,
    createdAt: record.createdAt.toISOString(),
  };
}
