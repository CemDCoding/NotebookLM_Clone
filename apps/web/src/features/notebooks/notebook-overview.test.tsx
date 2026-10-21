import { ErrorCode, NOTEBOOK_TITLE_MAX_LENGTH, type Notebook } from '@notebooklm/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import NotebooksPage from '@/app/(app)/notebooks/page';
import { ApiError, type ApiRequestOptions } from '@/lib/api-client';

const apiFetch = vi.hoisted(() => vi.fn());

// Only apiFetch is replaced; ApiError stays real so the components see genuine API errors.
vi.mock('@/lib/api-client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api-client')>()),
  apiFetch,
}));
vi.mock('@/lib/supabase/client', () => ({ createSupabaseBrowserClient: vi.fn() }));

const notebook: Notebook = {
  id: '6f1c2b8e-3d4a-4f5b-9c6d-7e8f9a0b1c2d',
  title: 'Projektbericht',
  createdAt: '2026-10-20T08:00:00.000Z',
  updatedAt: '2026-10-21T09:30:00.000Z',
  sourceCount: 2,
};

/** Answers the list request with `notebooks`; every other request with `onWrite`. */
function mockApi(notebooks: Notebook[], onWrite: () => Promise<unknown> = async () => notebook) {
  apiFetch.mockImplementation((_path: string, options: ApiRequestOptions = {}) =>
    options.method === undefined || options.method === 'GET'
      ? Promise.resolve({ notebooks })
      : onWrite(),
  );
}

function writeCalls() {
  return apiFetch.mock.calls.filter(([, options]) => options?.method !== undefined);
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <NotebooksPage />
    </QueryClientProvider>,
  );
}

async function openCreateDialog() {
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: 'Neues Notebook' }));
  const dialog = await screen.findByRole('dialog', { name: 'Neues Notebook' });
  return { user, dialog };
}

describe('notebook overview', () => {
  beforeEach(() => {
    apiFetch.mockReset();
  });

  it('shows the empty state when there are no notebooks', async () => {
    mockApi([]);
    renderPage();

    expect(await screen.findByRole('heading', { name: 'Noch keine Notebooks' })).toBeVisible();
    expect(screen.queryByRole('list', { name: 'Deine Notebooks' })).not.toBeInTheDocument();
  });

  it('lists notebooks with source count and a link to the notebook', async () => {
    mockApi([notebook]);
    renderPage();

    const link = await screen.findByRole('link', { name: 'Projektbericht' });
    expect(link).toHaveAttribute('href', `/notebooks/${notebook.id}`);
    expect(screen.getByText(/2 Quellen/)).toBeVisible();
  });

  it('offers a retry when the list cannot be loaded', async () => {
    apiFetch.mockRejectedValueOnce(new ApiError(0, 'Der Server ist gerade nicht erreichbar.'));
    renderPage();

    expect(await screen.findByRole('alert')).toHaveTextContent('nicht erreichbar');

    mockApi([notebook]);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Erneut versuchen' }));

    expect(await screen.findByRole('link', { name: 'Projektbericht' })).toBeVisible();
  });

  describe('creating a notebook', () => {
    it('rejects an empty title without calling the API', async () => {
      mockApi([]);
      renderPage();
      const { user, dialog } = await openCreateDialog();

      await user.type(within(dialog).getByLabelText('Titel'), '   ');
      await user.click(within(dialog).getByRole('button', { name: 'Anlegen' }));

      expect(within(dialog).getByRole('alert')).toHaveTextContent('Bitte gib einen Titel ein.');
      expect(within(dialog).getByLabelText('Titel')).toHaveAttribute('aria-invalid', 'true');
      expect(writeCalls()).toHaveLength(0);
    });

    it('rejects a title that is too long without calling the API', async () => {
      mockApi([]);
      renderPage();
      const { user, dialog } = await openCreateDialog();

      await user.click(within(dialog).getByLabelText('Titel'));
      await user.paste('a'.repeat(NOTEBOOK_TITLE_MAX_LENGTH + 1));
      await user.click(within(dialog).getByRole('button', { name: 'Anlegen' }));

      expect(within(dialog).getByRole('alert')).toHaveTextContent(
        `höchstens ${NOTEBOOK_TITLE_MAX_LENGTH} Zeichen`,
      );
      expect(writeCalls()).toHaveLength(0);
    });

    it('sends the trimmed title and closes the dialog', async () => {
      mockApi([]);
      renderPage();
      const { user, dialog } = await openCreateDialog();

      await user.type(within(dialog).getByLabelText('Titel'), '  Mein Notebook  ');
      await user.click(within(dialog).getByRole('button', { name: 'Anlegen' }));

      await waitFor(() => expect(dialog).not.toBeInTheDocument());
      expect(writeCalls()).toEqual([
        [
          '/notebooks',
          expect.objectContaining({ method: 'POST', body: { title: 'Mein Notebook' } }),
        ],
      ]);
    });

    it('shows the message of the API when the notebook limit is reached', async () => {
      const limitMessage = 'Du hast das Limit von 25 Notebooks erreicht. Lösche ein Notebook.';
      mockApi([], () => Promise.reject(new ApiError(429, limitMessage, ErrorCode.LIMIT_EXCEEDED)));
      renderPage();
      const { user, dialog } = await openCreateDialog();

      await user.type(within(dialog).getByLabelText('Titel'), 'Noch eins');
      await user.click(within(dialog).getByRole('button', { name: 'Anlegen' }));

      expect(await within(dialog).findByRole('alert')).toHaveTextContent(limitMessage);
      expect(dialog).toBeInTheDocument();
    });
  });

  it('renames a notebook, starting from its current title', async () => {
    mockApi([notebook]);
    renderPage();
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Aktionen für „Projektbericht“' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Umbenennen' }));
    const dialog = await screen.findByRole('dialog', { name: 'Notebook umbenennen' });
    const input = within(dialog).getByLabelText('Titel');
    expect(input).toHaveValue('Projektbericht');

    await user.clear(input);
    await user.type(input, 'Abschlussbericht');
    await user.click(within(dialog).getByRole('button', { name: 'Speichern' }));

    await waitFor(() => expect(dialog).not.toBeInTheDocument());
    expect(writeCalls()).toEqual([
      [
        `/notebooks/${notebook.id}`,
        expect.objectContaining({ method: 'PATCH', body: { title: 'Abschlussbericht' } }),
      ],
    ]);
  });

  describe('deleting a notebook', () => {
    async function openDeleteDialog() {
      const user = userEvent.setup();
      await user.click(
        await screen.findByRole('button', { name: 'Aktionen für „Projektbericht“' }),
      );
      await user.click(await screen.findByRole('menuitem', { name: 'Löschen' }));
      const dialog = await screen.findByRole('alertdialog', { name: 'Notebook löschen?' });
      return { user, dialog };
    }

    it('asks for confirmation and does nothing on cancel', async () => {
      mockApi([notebook]);
      renderPage();
      const { user, dialog } = await openDeleteDialog();

      expect(dialog).toHaveTextContent('„Projektbericht“ wird mit allen Quellen');
      await user.click(within(dialog).getByRole('button', { name: 'Abbrechen' }));

      await waitFor(() => expect(dialog).not.toBeInTheDocument());
      expect(writeCalls()).toHaveLength(0);
    });

    it('deletes the notebook after confirmation', async () => {
      mockApi([notebook], async () => undefined);
      renderPage();
      const { user, dialog } = await openDeleteDialog();

      await user.click(within(dialog).getByRole('button', { name: 'Löschen' }));

      await waitFor(() => expect(dialog).not.toBeInTheDocument());
      expect(writeCalls()).toEqual([
        [`/notebooks/${notebook.id}`, expect.objectContaining({ method: 'DELETE' })],
      ]);
    });
  });
});
