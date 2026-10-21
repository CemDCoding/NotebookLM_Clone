import type { Source, SourceStatus } from '@notebooklm/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, type ApiRequestOptions } from '@/lib/api-client';
import { SourcePanel } from './source-panel';

const apiFetch = vi.hoisted(() => vi.fn());

// Only apiFetch is replaced; ApiError stays real so the components see genuine API errors.
vi.mock('@/lib/api-client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api-client')>()),
  apiFetch,
}));
vi.mock('@/lib/supabase/client', () => ({ createSupabaseBrowserClient: vi.fn() }));

const notebookId = '6f1c2b8e-3d4a-4f5b-9c6d-7e8f9a0b1c2d';

function makeSource(overrides: Partial<Source> & Pick<Source, 'id' | 'title'>): Source {
  return {
    notebookId,
    type: 'pdf',
    status: 'pending',
    error: null,
    isActive: true,
    createdAt: '2026-10-21T09:30:00.000Z',
    ...overrides,
  };
}

const report = makeSource({ id: '0b5d7c1e-1a2b-4c3d-8e4f-5a6b7c8d9e01', title: 'Bericht.pdf' });

/** Answers the list request with `sources`; every other request with `onWrite`. */
function mockApi(sources: Source[], onWrite: () => Promise<unknown> = async () => undefined) {
  apiFetch.mockImplementation((_path: string, options: ApiRequestOptions = {}) =>
    options.method === undefined || options.method === 'GET'
      ? Promise.resolve({ sources })
      : onWrite(),
  );
}

function writeCalls() {
  return apiFetch.mock.calls.filter(([, options]) => options?.method !== undefined);
}

function renderPanel() {
  // The hooks retry once unless the answer is 404; without a delay that retry is instant.
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retryDelay: 0 } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <SourcePanel notebookId={notebookId} />
    </QueryClientProvider>,
  );
}

describe('source panel', () => {
  beforeEach(() => {
    apiFetch.mockReset();
  });

  it('shows the empty state when the notebook has no sources', async () => {
    mockApi([]);
    renderPanel();

    expect(
      await screen.findByText(
        'Noch keine Quellen. Lade ein PDF hoch oder füge Text ein, um loszulegen.',
      ),
    ).toBeVisible();
    expect(
      screen.queryByRole('list', { name: 'Quellen dieses Notebooks' }),
    ).not.toBeInTheDocument();
  });

  it.each<[SourceStatus, string]>([
    ['pending', 'wartet'],
    ['processing', 'wird verarbeitet'],
    ['ready', 'bereit'],
    ['failed', 'fehlgeschlagen'],
  ])('labels the status %s as „%s“', async (status, label) => {
    mockApi([{ ...report, status }]);
    renderPanel();

    const item = (await screen.findByText('Bericht.pdf')).closest('li');
    expect(item).not.toBeNull();
    expect(within(item as HTMLElement).getByText(label)).toBeVisible();
  });

  it('lists the sources with their active count', async () => {
    mockApi([
      report,
      makeSource({
        id: '0b5d7c1e-1a2b-4c3d-8e4f-5a6b7c8d9e02',
        title: 'Notizen',
        type: 'pasted',
        isActive: false,
      }),
    ]);
    renderPanel();

    const list = await screen.findByRole('list', { name: 'Quellen dieses Notebooks' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getByText('1 von 2 im Chat aktiv')).toBeVisible();
    expect(screen.getByRole('switch', { name: '„Notizen“ im Chat verwenden' })).not.toBeChecked();
  });

  it('offers a retry when the sources cannot be loaded', async () => {
    apiFetch.mockRejectedValue(new ApiError(0, 'Der Server ist gerade nicht erreichbar.'));
    renderPanel();

    expect(await screen.findByRole('alert')).toHaveTextContent('nicht erreichbar');

    mockApi([report]);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Erneut versuchen' }));

    expect(await screen.findByText('Bericht.pdf')).toBeVisible();
  });

  describe('toggling a source', () => {
    it('deactivates the source', async () => {
      mockApi([report]);
      renderPanel();
      const toggle = await screen.findByRole('switch', { name: '„Bericht.pdf“ im Chat verwenden' });

      await userEvent.setup().click(toggle);

      expect(writeCalls()).toEqual([
        [
          `/notebooks/${notebookId}/sources/${report.id}`,
          expect.objectContaining({ method: 'PATCH', body: { isActive: false } }),
        ],
      ]);
    });

    it('switches back when the API rejects the change', async () => {
      mockApi([report], () => Promise.reject(new ApiError(500, 'Fehler')));
      renderPanel();
      const toggle = await screen.findByRole('switch', { name: '„Bericht.pdf“ im Chat verwenden' });

      await userEvent.setup().click(toggle);

      await waitFor(() => expect(writeCalls()).toHaveLength(1));
      await waitFor(() => expect(toggle).toBeChecked());
    });
  });

  describe('deleting a source', () => {
    async function openDeleteDialog() {
      const user = userEvent.setup();
      await user.click(await screen.findByRole('button', { name: 'Aktionen für „Bericht.pdf“' }));
      await user.click(await screen.findByRole('menuitem', { name: 'Löschen' }));
      const dialog = await screen.findByRole('alertdialog', { name: 'Quelle löschen?' });
      return { user, dialog };
    }

    it('asks for confirmation and does nothing on cancel', async () => {
      mockApi([report]);
      renderPanel();
      const { user, dialog } = await openDeleteDialog();

      expect(dialog).toHaveTextContent('„Bericht.pdf“ wird mit der Datei');
      await user.click(within(dialog).getByRole('button', { name: 'Abbrechen' }));

      await waitFor(() => expect(dialog).not.toBeInTheDocument());
      expect(writeCalls()).toHaveLength(0);
    });

    it('deletes the source after confirmation', async () => {
      mockApi([report]);
      renderPanel();
      const { user, dialog } = await openDeleteDialog();

      await user.click(within(dialog).getByRole('button', { name: 'Löschen' }));

      await waitFor(() => expect(dialog).not.toBeInTheDocument());
      expect(writeCalls()).toEqual([
        [
          `/notebooks/${notebookId}/sources/${report.id}`,
          expect.objectContaining({ method: 'DELETE' }),
        ],
      ]);
    });

    it('keeps the dialog open and shows the error when deleting fails', async () => {
      mockApi([report], () =>
        Promise.reject(new ApiError(500, 'Die Quelle konnte nicht gelöscht werden.')),
      );
      renderPanel();
      const { user, dialog } = await openDeleteDialog();

      await user.click(within(dialog).getByRole('button', { name: 'Löschen' }));

      expect(await within(dialog).findByRole('alert')).toHaveTextContent(
        'Die Quelle konnte nicht gelöscht werden.',
      );
      expect(dialog).toBeInTheDocument();
    });
  });
});
