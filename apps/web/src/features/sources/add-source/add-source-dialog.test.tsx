import { DEFAULT_LIMITS } from '@notebooklm/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api-client';
import { AddSourceDialog } from './add-source-dialog';

const apiFetch = vi.hoisted(() => vi.fn());

// Only apiFetch is replaced; ApiError stays real so the forms see genuine API errors.
vi.mock('@/lib/api-client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api-client')>()),
  apiFetch,
}));
vi.mock('@/lib/supabase/client', () => ({ createSupabaseBrowserClient: vi.fn() }));

const notebookId = '6f1c2b8e-3d4a-4f5b-9c6d-7e8f9a0b1c2d';
const sourcesPath = `/notebooks/${notebookId}/sources`;

function renderDialog() {
  const queryClient = new QueryClient();
  render(
    <QueryClientProvider client={queryClient}>
      <AddSourceDialog notebookId={notebookId} />
    </QueryClientProvider>,
  );
  // The picker's `accept` would silently drop wrong files; the browser offers „all files“ too.
  return userEvent.setup({ applyAccept: false });
}

async function openDialog(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Quelle hinzufügen' }));
  return screen.findByRole('dialog', { name: 'Quelle hinzufügen' });
}

function makeFile(name: string, size: number, type = 'application/pdf'): File {
  const file = new File(['x'], name, { type });
  // Allocating real megabytes would slow the test down; only the reported size matters.
  Object.defineProperty(file, 'size', { value: size });
  return file;
}

describe('add source dialog', () => {
  beforeEach(() => {
    apiFetch.mockReset();
    apiFetch.mockResolvedValue(undefined);
  });

  describe('file tab', () => {
    it('shows the limits before anything is sent', async () => {
      const user = renderDialog();
      const dialog = await openDialog(user);

      expect(within(dialog).getByText('PDF, TXT oder Markdown, höchstens 10 MB.')).toBeVisible();
      expect(within(dialog).getByRole('button', { name: 'Hochladen' })).toBeDisabled();
    });

    it('rejects a file with an unsupported extension', async () => {
      const user = renderDialog();
      const dialog = await openDialog(user);

      await user.upload(
        within(dialog).getByLabelText('Datei auswählen'),
        makeFile('bild.png', 100),
      );

      expect(within(dialog).getByRole('alert')).toHaveTextContent(
        'Dieser Dateityp wird nicht unterstützt.',
      );
      expect(within(dialog).getByRole('button', { name: 'Hochladen' })).toBeDisabled();
      expect(apiFetch).not.toHaveBeenCalled();
    });

    it('rejects a file above the size limit', async () => {
      const user = renderDialog();
      const dialog = await openDialog(user);

      await user.upload(
        within(dialog).getByLabelText('Datei auswählen'),
        makeFile('gross.pdf', DEFAULT_LIMITS.maxFileSizeBytes + 1),
      );

      expect(within(dialog).getByRole('alert')).toHaveTextContent(
        'Die Datei ist größer als 10 MB. Bitte lade eine kleinere Datei hoch.',
      );
      expect(within(dialog).getByRole('button', { name: 'Hochladen' })).toBeDisabled();
    });

    it('checks a dropped file the same way', async () => {
      const user = renderDialog();
      const dialog = await openDialog(user);
      const dropZone = within(dialog).getByText('Datei hierher ziehen oder').parentElement;

      fireEvent.drop(dropZone as HTMLElement, {
        dataTransfer: { files: [makeFile('tabelle.xlsx', 100)] },
      });

      expect(within(dialog).getByRole('alert')).toHaveTextContent(
        'Dieser Dateityp wird nicht unterstützt.',
      );
    });

    it('uploads a valid file as multipart and closes the dialog', async () => {
      const user = renderDialog();
      const dialog = await openDialog(user);
      const file = makeFile('Bericht.pdf', 2048);

      await user.upload(within(dialog).getByLabelText('Datei auswählen'), file);
      expect(within(dialog).getByText('Bericht.pdf')).toBeVisible();
      await user.click(within(dialog).getByRole('button', { name: 'Hochladen' }));

      await waitFor(() => expect(dialog).not.toBeInTheDocument());
      expect(apiFetch).toHaveBeenCalledWith(
        `${sourcesPath}/upload`,
        expect.objectContaining({ method: 'POST', body: expect.any(FormData) }),
      );
      const [[, options]] = apiFetch.mock.calls as [[string, { body: FormData }]];
      expect(options.body.get('file')).toBe(file);
    });

    it('keeps the dialog open and shows the API message on 429', async () => {
      apiFetch.mockRejectedValue(
        new ApiError(
          429,
          'Dieses Notebook hat bereits 20 Quellen. Lösche eine, um Platz zu schaffen.',
        ),
      );
      const user = renderDialog();
      const dialog = await openDialog(user);

      await user.upload(within(dialog).getByLabelText('Datei auswählen'), makeFile('a.pdf', 10));
      await user.click(within(dialog).getByRole('button', { name: 'Hochladen' }));

      expect(await within(dialog).findByRole('alert')).toHaveTextContent(
        'Dieses Notebook hat bereits 20 Quellen.',
      );
      expect(dialog).toBeInTheDocument();
    });
  });

  describe('text tab', () => {
    async function openTextTab() {
      const user = renderDialog();
      const dialog = await openDialog(user);
      await user.click(within(dialog).getByRole('tab', { name: 'Text einfügen' }));
      return { user, dialog };
    }

    it('counts the characters against the limit', async () => {
      const { user, dialog } = await openTextTab();

      expect(within(dialog).getByText('0 / 500.000')).toBeVisible();
      await user.type(within(dialog).getByLabelText('Text'), 'Hallo');

      expect(within(dialog).getByText('5 / 500.000')).toBeVisible();
    });

    it('disables „Hinzufügen“ above the character limit', async () => {
      const { user, dialog } = await openTextTab();
      const textarea = within(dialog).getByLabelText('Text');

      await user.click(textarea);
      await user.paste('a'.repeat(DEFAULT_LIMITS.maxPastedTextChars + 1));

      expect(within(dialog).getByText('500.001 / 500.000')).toBeVisible();
      expect(within(dialog).getByRole('alert')).toHaveTextContent('Der Text ist zu lang.');
      expect(within(dialog).getByRole('button', { name: 'Hinzufügen' })).toBeDisabled();

      await user.keyboard('{Backspace}');

      expect(within(dialog).getByRole('button', { name: 'Hinzufügen' })).toBeEnabled();
    });

    it('asks for a title and a text before sending', async () => {
      const { user, dialog } = await openTextTab();

      await user.type(within(dialog).getByLabelText('Text'), '   ');
      await user.click(within(dialog).getByRole('button', { name: 'Hinzufügen' }));

      const alerts = within(dialog).getAllByRole('alert');
      expect(alerts.map((alert) => alert.textContent)).toEqual([
        'Bitte gib einen Titel ein.',
        'Bitte füge einen Text ein.',
      ]);
      expect(apiFetch).not.toHaveBeenCalled();
    });

    it('sends the pasted text and closes the dialog', async () => {
      const { user, dialog } = await openTextTab();

      await user.type(within(dialog).getByLabelText('Titel'), '  Notizen  ');
      await user.type(within(dialog).getByLabelText('Text'), 'Erste Zeile');
      await user.click(within(dialog).getByRole('button', { name: 'Hinzufügen' }));

      await waitFor(() => expect(dialog).not.toBeInTheDocument());
      expect(apiFetch).toHaveBeenCalledWith(`${sourcesPath}/text`, {
        method: 'POST',
        body: { title: 'Notizen', text: 'Erste Zeile' },
      });
    });

    it('shows the API message when the request is rejected', async () => {
      apiFetch.mockRejectedValue(
        new ApiError(429, 'Das Tageslimit für Uploads ist erreicht. Versuche es morgen erneut.'),
      );
      const { user, dialog } = await openTextTab();

      await user.type(within(dialog).getByLabelText('Titel'), 'Notizen');
      await user.type(within(dialog).getByLabelText('Text'), 'Inhalt');
      await user.click(within(dialog).getByRole('button', { name: 'Hinzufügen' }));

      expect(await within(dialog).findByRole('alert')).toHaveTextContent(
        'Das Tageslimit für Uploads ist erreicht.',
      );
      expect(dialog).toBeInTheDocument();
    });
  });
});
