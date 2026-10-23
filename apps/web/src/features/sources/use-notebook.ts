import { NotebookSchema } from '@notebooklm/shared';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api-client';
import { notebookKeys } from '@/features/notebooks/query-keys';
import { retryUnlessNotFound } from './is-not-found-error';

/**
 * A single notebook. It uses the detail key of the notebooks feature, so renaming and deleting
 * there keep this view up to date. Lives here because the notebooks feature has no such hook yet.
 */
export function useNotebook(id: string) {
  return useQuery({
    queryKey: notebookKeys.detail(id),
    queryFn: ({ signal }) =>
      apiFetch(`/notebooks/${encodeURIComponent(id)}`, { schema: NotebookSchema, signal }),
    retry: retryUnlessNotFound,
  });
}
