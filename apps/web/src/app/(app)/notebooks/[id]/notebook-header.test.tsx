import { ErrorCode, type Notebook } from '@notebooklm/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api-client';
import { NotebookHeader } from './notebook-header';

const apiFetch = vi.hoisted(() => vi.fn());
const notFound = vi.hoisted(() => vi.fn());

vi.mock('@/lib/api-client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api-client')>()),
  apiFetch,
}));
vi.mock('@/lib/supabase/client', () => ({ createSupabaseBrowserClient: vi.fn() }));
vi.mock('next/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/navigation')>()),
  notFound,
}));

const notebook: Notebook = {
  id: '6f1c2b8e-3d4a-4f5b-9c6d-7e8f9a0b1c2d',
  title: 'Projektbericht',
  createdAt: '2026-10-20T08:00:00.000Z',
  updatedAt: '2026-10-21T09:30:00.000Z',
  sourceCount: 2,
};

function renderHeader() {
  // The hooks retry once unless the answer is 404; without a delay that retry is instant.
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retryDelay: 0 } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <NotebookHeader notebookId={notebook.id} />
    </QueryClientProvider>,
  );
}

describe('notebook header', () => {
  beforeEach(() => {
    apiFetch.mockReset();
    notFound.mockReset();
  });

  it('shows the notebook title and a link back to the overview', async () => {
    apiFetch.mockResolvedValue(notebook);
    renderHeader();

    expect(await screen.findByRole('heading', { level: 1, name: 'Projektbericht' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'Alle Notebooks' })).toHaveAttribute(
      'href',
      '/notebooks',
    );
    expect(apiFetch).toHaveBeenCalledWith(`/notebooks/${notebook.id}`, expect.anything());
  });

  it('shows the not-found page for an unknown notebook', async () => {
    apiFetch.mockRejectedValue(
      new ApiError(404, 'Das Notebook wurde nicht gefunden.', ErrorCode.NOT_FOUND),
    );
    renderHeader();

    await waitFor(() => expect(notFound).toHaveBeenCalled());
  });

  it('offers a retry for other errors instead of the not-found page', async () => {
    apiFetch.mockRejectedValue(new ApiError(0, 'Der Server ist gerade nicht erreichbar.'));
    renderHeader();

    expect(await screen.findByRole('alert')).toHaveTextContent('nicht erreichbar');
    expect(screen.getByRole('button', { name: 'Erneut versuchen' })).toBeVisible();
    expect(notFound).not.toHaveBeenCalled();
  });
});
