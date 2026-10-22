import {
  SourceListResponseSchema,
  type Source,
  type SourceListResponse,
  type UpdateSourceRequest,
} from '@notebooklm/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api-client';
import { notebookKeys } from '@/features/notebooks/query-keys';
import { retryUnlessNotFound } from './is-not-found-error';
import { sourceKeys } from './query-keys';

function sourcesPath(notebookId: string): string {
  return `/notebooks/${encodeURIComponent(notebookId)}/sources`;
}

function sourcePath(notebookId: string, sourceId: string): string {
  return `${sourcesPath(notebookId)}/${encodeURIComponent(sourceId)}`;
}

/** Polling interval while a source is still being ingested (PE-36). */
export const SOURCE_POLL_INTERVAL_MS = 2_000;

/**
 * Polls only while a source is waiting or being processed, so the status switches to
 * ready or failed without a reload and the polling stops once every source is done.
 */
export function sourcesRefetchInterval(sources: readonly Source[] | undefined): number | false {
  const hasUnfinished = sources?.some(
    (source) => source.status === 'pending' || source.status === 'processing',
  );
  return hasUnfinished ? SOURCE_POLL_INTERVAL_MS : false;
}

export function useSources(notebookId: string) {
  return useQuery({
    queryKey: sourceKeys.list(notebookId),
    queryFn: ({ signal }) =>
      apiFetch(sourcesPath(notebookId), { schema: SourceListResponseSchema, signal }),
    select: (data) => data.sources,
    // The interval sees the raw response, not the selected list.
    refetchInterval: (query) => sourcesRefetchInterval(query.state.data?.sources),
    retry: retryUnlessNotFound,
  });
}

type ToggleSourceVariables = UpdateSourceRequest & { sourceId: string };

export function useToggleSource(notebookId: string) {
  const queryClient = useQueryClient();
  const queryKey = sourceKeys.list(notebookId);

  return useMutation({
    // The response body is not needed: the list is refetched once the change is settled.
    mutationFn: ({ sourceId, isActive }: ToggleSourceVariables) =>
      apiFetch(sourcePath(notebookId, sourceId), { method: 'PATCH', body: { isActive } }),
    // The switch flips at once instead of waiting for the round trip; a failure rolls it back.
    onMutate: async ({ sourceId, isActive }) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<SourceListResponse>(queryKey);
      queryClient.setQueryData<SourceListResponse>(queryKey, (data) =>
        data
          ? {
              sources: data.sources.map((source) =>
                source.id === sourceId ? { ...source, isActive } : source,
              ),
            }
          : data,
      );
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous);
      }
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey }),
  });
}

export function useDeleteSource(notebookId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (sourceId: string) =>
      apiFetch(sourcePath(notebookId, sourceId), { method: 'DELETE' }),
    // Returning the promise closes the dialog only once the list no longer shows the source.
    // The notebook queries carry the source count, so they are refreshed as well.
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: sourceKeys.list(notebookId) }),
        queryClient.invalidateQueries({ queryKey: notebookKeys.list() }),
        queryClient.invalidateQueries({ queryKey: notebookKeys.detail(notebookId) }),
      ]),
  });
}
