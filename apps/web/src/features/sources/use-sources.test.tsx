import type { Source, SourceStatus } from '@notebooklm/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { chatKeys } from '@/features/chat/query-keys';
import {
  SOURCE_POLL_INTERVAL_MS,
  sourcesRefetchInterval,
  useDeleteSource,
  useSources,
} from './use-sources';

const apiFetch = vi.hoisted(() => vi.fn());

vi.mock('@/lib/api-client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api-client')>()),
  apiFetch,
}));
vi.mock('@/lib/supabase/client', () => ({ createSupabaseBrowserClient: vi.fn() }));

const notebookId = '6f1c2b8e-3d4a-4f5b-9c6d-7e8f9a0b1c2d';

function makeSource(status: SourceStatus, id = '0b5d7c1e-1a2b-4c3d-8e4f-5a6b7c8d9e01'): Source {
  return {
    id,
    notebookId,
    type: 'pdf',
    title: 'Bericht.pdf',
    status,
    error: null,
    isActive: true,
    createdAt: '2026-10-21T09:30:00.000Z',
  };
}

describe('sourcesRefetchInterval', () => {
  it.each<SourceStatus>(['pending', 'processing'])('polls while a source is %s', (status) => {
    expect(sourcesRefetchInterval([makeSource('ready'), makeSource(status)])).toBe(
      SOURCE_POLL_INTERVAL_MS,
    );
  });

  it('stops polling once every source is ready or failed', () => {
    expect(sourcesRefetchInterval([makeSource('ready'), makeSource('failed')])).toBe(false);
  });

  it('does not poll an empty or not yet loaded list', () => {
    expect(sourcesRefetchInterval([])).toBe(false);
    expect(sourcesRefetchInterval(undefined)).toBe(false);
  });

  it('polls every two seconds', () => {
    expect(SOURCE_POLL_INTERVAL_MS).toBe(2_000);
  });
});

describe('useDeleteSource', () => {
  const sourceId = '0b5d7c1e-1a2b-4c3d-8e4f-5a6b7c8d9e01';

  function setup() {
    apiFetch.mockReset();
    const queryClient = new QueryClient();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useDeleteSource(notebookId), { wrapper });
    return { result, invalidate };
  }

  it('refreshes the chat history so citations of the deleted source update', async () => {
    const { result, invalidate } = setup();
    apiFetch.mockResolvedValue(undefined);

    await act(() => result.current.mutateAsync(sourceId));

    expect(invalidate).toHaveBeenCalledWith({ queryKey: chatKeys.messages(notebookId) });
  });

  it('leaves the chat history alone when the deletion fails', async () => {
    const { result, invalidate } = setup();
    apiFetch.mockRejectedValue(new Error('boom'));

    await act(() => result.current.mutateAsync(sourceId).catch(() => undefined));

    expect(invalidate).not.toHaveBeenCalledWith({ queryKey: chatKeys.messages(notebookId) });
  });
});

describe('useSources polling', () => {
  beforeEach(() => {
    apiFetch.mockReset();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('refetches while a source is processing and stops once it is ready', async () => {
    apiFetch
      .mockResolvedValueOnce({ sources: [makeSource('pending')] })
      .mockResolvedValueOnce({ sources: [makeSource('processing')] })
      .mockResolvedValue({ sources: [makeSource('ready')] });

    const queryClient = new QueryClient();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useSources(notebookId), { wrapper });

    await waitFor(() => expect(result.current.data?.[0]?.status).toBe('pending'));

    await act(() => vi.advanceTimersByTimeAsync(SOURCE_POLL_INTERVAL_MS));
    await waitFor(() => expect(result.current.data?.[0]?.status).toBe('processing'));

    await act(() => vi.advanceTimersByTimeAsync(SOURCE_POLL_INTERVAL_MS));
    await waitFor(() => expect(result.current.data?.[0]?.status).toBe('ready'));
    expect(apiFetch).toHaveBeenCalledTimes(3);

    // All sources are done: no further requests, however long the list stays open.
    await act(() => vi.advanceTimersByTimeAsync(SOURCE_POLL_INTERVAL_MS * 5));
    expect(apiFetch).toHaveBeenCalledTimes(3);
  });
});
