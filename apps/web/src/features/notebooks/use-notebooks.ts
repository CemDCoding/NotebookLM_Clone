import {
  NotebookListResponseSchema,
  NotebookSchema,
  type CreateNotebookRequest,
  type RenameNotebookRequest,
} from '@notebooklm/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api-client';
import { notebookKeys } from './query-keys';

export function useNotebooks() {
  return useQuery({
    queryKey: notebookKeys.list(),
    queryFn: ({ signal }) => apiFetch('/notebooks', { schema: NotebookListResponseSchema, signal }),
    select: (data) => data.notebooks,
  });
}

// The mutations return the invalidation promise, so a dialog closes only once the list
// already shows the change.

export function useCreateNotebook() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateNotebookRequest) =>
      apiFetch('/notebooks', { method: 'POST', body, schema: NotebookSchema }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: notebookKeys.list() }),
  });
}

export function useRenameNotebook() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: RenameNotebookRequest & { id: string }) =>
      apiFetch(`/notebooks/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body,
        schema: NotebookSchema,
      }),
    onSuccess: (_notebook, { id }) =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: notebookKeys.list() }),
        queryClient.invalidateQueries({ queryKey: notebookKeys.detail(id) }),
      ]),
  });
}

export function useDeleteNotebook() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/notebooks/${encodeURIComponent(id)}`, { method: 'DELETE' }),
    onSuccess: (_result, id) => {
      // A refetch of the deleted notebook could only fail with 404.
      queryClient.removeQueries({ queryKey: notebookKeys.detail(id) });
      return queryClient.invalidateQueries({ queryKey: notebookKeys.list() });
    },
  });
}
