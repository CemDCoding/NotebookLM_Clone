import { MessageListResponseSchema, ModelListResponseSchema } from '@notebooklm/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api-client';
import { retryUnlessNotFound } from '@/features/sources/is-not-found-error';
import { chatKeys } from './query-keys';

function messagesPath(notebookId: string): string {
  return `/notebooks/${encodeURIComponent(notebookId)}/messages`;
}

export function useMessages(notebookId: string) {
  return useQuery({
    queryKey: chatKeys.messages(notebookId),
    queryFn: ({ signal }) =>
      apiFetch(messagesPath(notebookId), { schema: MessageListResponseSchema, signal }),
    select: (data) => data.messages,
    // Citations are resolved live by the API, so a source deleted elsewhere only shows up as
    // „Quelle gelöscht“ after a refetch. Without the app's default stale time, opening the chat
    // again always loads the current state.
    staleTime: 0,
    retry: retryUnlessNotFound,
  });
}

export function useClearMessages(notebookId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    // The API answers 204 No Content.
    mutationFn: () => apiFetch(messagesPath(notebookId), { method: 'DELETE' }),
    // Returning the promise closes the dialog only once the list is empty.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: chatKeys.messages(notebookId) }),
  });
}

export function useModels() {
  return useQuery({
    queryKey: chatKeys.models(),
    queryFn: ({ signal }) => apiFetch('/models', { schema: ModelListResponseSchema, signal }),
    select: (data) => data.models,
    // The allowed models come from the API's configuration and only change with a deployment.
    staleTime: Infinity,
  });
}
