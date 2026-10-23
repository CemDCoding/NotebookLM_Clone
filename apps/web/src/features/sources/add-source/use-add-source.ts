import type { CreatePastedSourceRequest } from '@notebooklm/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api-client';
import { notebookKeys } from '@/features/notebooks/query-keys';
import { sourceKeys } from '../query-keys';

function sourcesPath(notebookId: string): string {
  return `/notebooks/${encodeURIComponent(notebookId)}/sources`;
}

/**
 * Refreshes everything a new source changes. Returned as a promise so the dialog closes only
 * once the list already shows the new source. The notebook queries carry the source count.
 */
function useInvalidateAfterAdd(notebookId: string) {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: sourceKeys.list(notebookId) }),
      queryClient.invalidateQueries({ queryKey: notebookKeys.list() }),
      queryClient.invalidateQueries({ queryKey: notebookKeys.detail(notebookId) }),
    ]);
}

export function useUploadSource(notebookId: string) {
  const invalidate = useInvalidateAfterAdd(notebookId);

  return useMutation({
    // The response body is not needed: the refetched list shows the new source.
    mutationFn: (file: File) => {
      const body = new FormData();
      body.append('file', file);
      return apiFetch(`${sourcesPath(notebookId)}/upload`, { method: 'POST', body });
    },
    onSuccess: invalidate,
  });
}

export function useAddPastedSource(notebookId: string) {
  const invalidate = useInvalidateAfterAdd(notebookId);

  return useMutation({
    mutationFn: (request: CreatePastedSourceRequest) =>
      apiFetch(`${sourcesPath(notebookId)}/text`, { method: 'POST', body: request }),
    onSuccess: invalidate,
  });
}
