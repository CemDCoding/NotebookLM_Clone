import type { ChatEvent, Message, Model, Source } from '@notebooklm/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, type ApiRequestOptions } from '@/lib/api-client';
import { ChatPanel } from './chat-panel';

const { apiFetch, apiFetchResponse } = vi.hoisted(() => ({
  apiFetch: vi.fn(),
  apiFetchResponse: vi.fn(),
}));

// Only the requests are replaced; ApiError stays real so the components see genuine API errors.
vi.mock('@/lib/api-client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api-client')>()),
  apiFetch,
  apiFetchResponse,
}));
vi.mock('@/lib/supabase/client', () => ({ createSupabaseBrowserClient: vi.fn() }));

const notebookId = '6f1c2b8e-3d4a-4f5b-9c6d-7e8f9a0b1c2d';
const messageId = '3c9e1f2a-4b5d-4e6f-8a7b-9c0d1e2f3a4b';
const questionId = '3c9e1f2a-4b5d-4e6f-8a7b-9c0d1e2f3a4a';

const readySource: Source = {
  id: '0b5d7c1e-1a2b-4c3d-8e4f-5a6b7c8d9e01',
  notebookId,
  type: 'pasted',
  title: 'Notizen',
  status: 'ready',
  error: null,
  isActive: true,
  createdAt: '2026-10-21T09:30:00.000Z',
};

const models: Model[] = [
  {
    id: 'mistral-small-latest',
    label: 'Mistral Small',
    provider: 'mistral',
    isLocal: false,
    isDefault: true,
  },
  {
    id: 'ollama:llama3.2',
    label: 'Llama 3.2',
    provider: 'ollama',
    isLocal: true,
    isDefault: false,
  },
];

function storedExchange(question: string, answer: string): Message[] {
  return [
    {
      id: questionId,
      role: 'user',
      content: question,
      model: null,
      citations: [],
      createdAt: '2026-10-23T10:00:00.000Z',
    },
    {
      id: messageId,
      role: 'assistant',
      content: answer,
      model: 'mistral-small-latest',
      citations: [],
      createdAt: '2026-10-23T10:00:01.000Z',
    },
  ];
}

interface ApiState {
  sources: Source[];
  messages: Message[];
  onClear: () => Promise<void>;
}

let api: ApiState;

function mockApi() {
  apiFetch.mockImplementation((path: string, options: ApiRequestOptions = {}) => {
    if (path === '/models') {
      return Promise.resolve({ models });
    }
    if (path === `/notebooks/${notebookId}/sources`) {
      return Promise.resolve({ sources: api.sources });
    }
    if (path === `/notebooks/${notebookId}/messages`) {
      return options.method === 'DELETE'
        ? api.onClear()
        : Promise.resolve({ messages: api.messages });
    }
    return Promise.reject(new Error(`Unexpected request ${path}`));
  });
}

function historyRequests() {
  return apiFetch.mock.calls.filter(
    ([path, options]) =>
      path === `/notebooks/${notebookId}/messages` && options?.method !== 'DELETE',
  );
}

function clearRequests() {
  return apiFetch.mock.calls.filter(([, options]) => options?.method === 'DELETE');
}

function frame(event: ChatEvent): string {
  return `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
}

/** Makes the next chat request answer with a stream the test feeds event by event. */
function nextStream() {
  const encoder = new TextEncoder();
  let controller!: ReadableStreamDefaultController<Uint8Array>;
  let resolveReady!: () => void;
  const ready = new Promise<void>((resolve) => {
    resolveReady = resolve;
  });
  apiFetchResponse.mockImplementationOnce(
    async (_path: string, options: { signal: AbortSignal }) => {
      const body = new ReadableStream<Uint8Array>({
        start(c) {
          controller = c;
        },
      });
      // Like a real fetch body, the stream errors once the request is aborted.
      options.signal.addEventListener('abort', () => controller.error(options.signal.reason));
      resolveReady();
      return new Response(body);
    },
  );
  return {
    ready,
    push: (event: ChatEvent) => controller.enqueue(encoder.encode(frame(event))),
    close: () => controller.close(),
  };
}

function renderPanel() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retryDelay: 0 } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <ChatPanel notebookId={notebookId} />
    </QueryClientProvider>,
  );
}

/** Waits until sources and models are loaded, so the question field can be used. */
async function readyInput() {
  const input = await screen.findByRole('textbox', { name: 'Frage' });
  await waitFor(() => expect(input).toBeEnabled());
  await waitFor(() =>
    expect(screen.getByRole('combobox', { name: 'Modell' })).toHaveTextContent('Mistral Small'),
  );
  return input;
}

describe('ChatPanel', () => {
  // Radix positions the select list with ResizeObserver and pointer capture, which jsdom lacks.
  beforeAll(() => {
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
    Element.prototype.hasPointerCapture = () => false;
    Element.prototype.scrollIntoView = () => {};
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  beforeEach(() => {
    apiFetch.mockReset();
    apiFetchResponse.mockReset();
    api = { sources: [readySource], messages: [], onClear: async () => undefined };
    mockApi();
  });

  describe('question field', () => {
    it('is disabled and names the reason while the notebook has no source', async () => {
      api.sources = [];
      renderPanel();

      const input = await screen.findByRole('textbox', { name: 'Frage' });
      await waitFor(() =>
        expect(input).toHaveAccessibleDescription(
          'Füge zuerst eine Quelle hinzu, um Fragen zu stellen.',
        ),
      );
      expect(input).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Frage senden' })).toBeDisabled();
    });

    it('is disabled while the only source is inactive', async () => {
      api.sources = [{ ...readySource, isActive: false }];
      renderPanel();

      const input = await screen.findByRole('textbox', { name: 'Frage' });
      await waitFor(() =>
        expect(input).toHaveAccessibleDescription(/Aktiviere mindestens eine fertige Quelle/),
      );
      expect(input).toBeDisabled();
    });

    it('breaks the line on Shift+Enter and sends with the default model on Enter', async () => {
      const stream = nextStream();
      renderPanel();
      const user = userEvent.setup();
      const input = await readyInput();

      await user.type(input, 'Erste Zeile{Shift>}{Enter}{/Shift}zweite Zeile');

      expect(input).toHaveValue('Erste Zeile\nzweite Zeile');
      expect(apiFetchResponse).not.toHaveBeenCalled();

      await user.keyboard('{Enter}');
      await stream.ready;

      expect(apiFetchResponse).toHaveBeenCalledWith(`/notebooks/${notebookId}/chat`, {
        method: 'POST',
        body: { question: 'Erste Zeile\nzweite Zeile', model: 'mistral-small-latest' },
        signal: expect.any(AbortSignal),
      });
      expect(input).toHaveValue('');
      expect(input).toHaveFocus();
    });

    it('does not send an empty question', async () => {
      renderPanel();
      const user = userEvent.setup();
      const input = await readyInput();

      await user.type(input, '   {Enter}');

      expect(apiFetchResponse).not.toHaveBeenCalled();
      expect(screen.getByRole('button', { name: 'Frage senden' })).toBeDisabled();
    });
  });

  describe('model picker', () => {
    it('preselects the default model and labels local models', async () => {
      renderPanel();
      const user = userEvent.setup();
      await readyInput();

      await user.click(screen.getByRole('combobox', { name: 'Modell' }));

      const local = await screen.findByRole('option', { name: /Llama 3\.2/ });
      expect(local).toHaveTextContent('Lokal');
      expect(screen.getByRole('option', { name: 'Mistral Small' })).toHaveAttribute(
        'aria-selected',
        'true',
      );
    });

    it('sends the chosen model', async () => {
      const stream = nextStream();
      renderPanel();
      const user = userEvent.setup();
      const input = await readyInput();

      await user.click(screen.getByRole('combobox', { name: 'Modell' }));
      await user.click(await screen.findByRole('option', { name: /Llama 3\.2/ }));
      await user.type(input, 'Frage{Enter}');
      await stream.ready;

      expect(apiFetchResponse).toHaveBeenCalledWith(
        `/notebooks/${notebookId}/chat`,
        expect.objectContaining({ body: { question: 'Frage', model: 'ollama:llama3.2' } }),
      );
    });

    it('falls back to the default model of the API when the list cannot be loaded', async () => {
      const stream = nextStream();
      const answerWithSources = apiFetch.getMockImplementation();
      apiFetch.mockImplementation((path: string, options?: ApiRequestOptions) =>
        path === '/models'
          ? Promise.reject(new ApiError(0, 'Der Server ist gerade nicht erreichbar.'))
          : answerWithSources?.(path, options),
      );
      renderPanel();
      const user = userEvent.setup();

      const picker = screen.getByRole('combobox', { name: 'Modell' });
      await waitFor(() => expect(picker).toHaveTextContent('Standardmodell'));
      expect(picker).toBeDisabled();

      const input = screen.getByRole('textbox', { name: 'Frage' });
      await waitFor(() => expect(input).toBeEnabled());
      await user.type(input, 'Frage{Enter}');
      await stream.ready;

      const [, request] = apiFetchResponse.mock.calls[0] as [string, ApiRequestOptions];
      expect(request.body).toEqual({ question: 'Frage' });
    });
  });

  describe('streaming', () => {
    it('replaces the send button with a stop button and marks a stopped answer', async () => {
      const stream = nextStream();
      renderPanel();
      const user = userEvent.setup();
      const input = await readyInput();

      await user.type(input, 'Worum geht es?{Enter}');
      await stream.ready;

      expect(screen.queryByRole('button', { name: 'Frage senden' })).not.toBeInTheDocument();
      expect(screen.getByRole('status', { name: 'Antwort wird erstellt' })).toBeInTheDocument();

      stream.push({ type: 'token', text: 'Ein Teil der Antwort' });
      expect(await screen.findByText('Ein Teil der Antwort')).toBeVisible();

      await user.click(screen.getByRole('button', { name: 'Antwort stoppen' }));

      expect(await screen.findByText('Abgebrochen')).toBeVisible();
      expect(screen.getByText('Ein Teil der Antwort')).toBeVisible();
      expect(screen.getByRole('button', { name: 'Frage senden' })).toBeInTheDocument();
      const signal = apiFetchResponse.mock.calls[0]?.[1].signal as AbortSignal;
      expect(signal.aborted).toBe(true);
      // Nothing was stored, so the history is not loaded again.
      expect(historyRequests()).toHaveLength(1);
    });

    it('shows a finished answer exactly once while the history is refetched', async () => {
      const stream = nextStream();
      renderPanel();
      const user = userEvent.setup();
      const input = await readyInput();

      await user.type(input, 'Worum geht es?{Enter}');
      await stream.ready;
      stream.push({ type: 'token', text: 'Die Antwort steht hier.' });
      expect(await screen.findByText('Die Antwort steht hier.')).toBeVisible();

      api.messages = storedExchange('Worum geht es?', 'Die Antwort steht hier.');
      stream.push({ type: 'citations', citations: [] });
      stream.push({ type: 'done', messageId, model: 'mistral-small-latest' });
      stream.close();

      await waitFor(() => expect(historyRequests()).toHaveLength(2));
      await waitFor(() =>
        expect(screen.getByRole('button', { name: 'Frage senden' })).toBeInTheDocument(),
      );
      const list = screen.getByRole('list', { name: 'Chatverlauf' });
      expect(within(list).getAllByRole('listitem')).toHaveLength(2);
      expect(within(list).getAllByText('Die Antwort steht hier.')).toHaveLength(1);
      expect(within(list).getAllByText('Worum geht es?')).toHaveLength(1);
    });

    it('shows the message of the API when it refuses the question', async () => {
      apiFetchResponse.mockRejectedValueOnce(
        new ApiError(409, 'Aktiviere mindestens eine fertige Quelle.', 'NO_READY_SOURCES'),
      );
      renderPanel();
      const user = userEvent.setup();
      const input = await readyInput();

      await user.type(input, 'Frage{Enter}');

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Aktiviere mindestens eine fertige Quelle.',
      );
    });
  });

  describe('history', () => {
    it('shows the stored messages and the empty state without any', async () => {
      api.messages = storedExchange('Was steht drin?', 'Eine Zusammenfassung.');
      renderPanel();

      expect(await screen.findByText('Eine Zusammenfassung.')).toBeVisible();
      expect(screen.getByText('Was steht drin?')).toBeVisible();
      expect(screen.queryByText('Frag deine Quellen')).not.toBeInTheDocument();
    });

    it('offers a retry when the history cannot be loaded', async () => {
      apiFetch.mockImplementation((path: string) =>
        path === `/notebooks/${notebookId}/messages`
          ? Promise.reject(new ApiError(0, 'Der Server ist gerade nicht erreichbar.'))
          : Promise.resolve(path === '/models' ? { models } : { sources: api.sources }),
      );
      renderPanel();

      expect(await screen.findByRole('alert')).toHaveTextContent('nicht erreichbar');

      mockApi();
      await userEvent.setup().click(screen.getByRole('button', { name: 'Erneut versuchen' }));

      expect(await screen.findByText('Frag deine Quellen')).toBeVisible();
    });
  });

  describe('clearing the history', () => {
    async function openDialog() {
      const user = userEvent.setup();
      await screen.findByText('Eine Zusammenfassung.');
      await user.click(screen.getByRole('button', { name: 'Verlauf löschen' }));
      const dialog = await screen.findByRole('alertdialog', { name: 'Chatverlauf löschen?' });
      return { user, dialog };
    }

    it('is not offered while the history is empty', async () => {
      renderPanel();

      expect(await screen.findByText('Frag deine Quellen')).toBeVisible();
      expect(screen.getByRole('button', { name: 'Verlauf löschen' })).toBeDisabled();
    });

    it('asks for confirmation and does nothing on cancel', async () => {
      api.messages = storedExchange('Was steht drin?', 'Eine Zusammenfassung.');
      renderPanel();
      const { user, dialog } = await openDialog();

      await user.click(within(dialog).getByRole('button', { name: 'Abbrechen' }));

      await waitFor(() => expect(dialog).not.toBeInTheDocument());
      expect(clearRequests()).toHaveLength(0);
      expect(screen.getByText('Eine Zusammenfassung.')).toBeVisible();
    });

    it('deletes the history after confirmation', async () => {
      api.messages = storedExchange('Was steht drin?', 'Eine Zusammenfassung.');
      api.onClear = async () => {
        api.messages = [];
      };
      renderPanel();
      const { user, dialog } = await openDialog();

      await user.click(within(dialog).getByRole('button', { name: 'Löschen' }));

      await waitFor(() => expect(dialog).not.toBeInTheDocument());
      expect(clearRequests()).toEqual([
        [`/notebooks/${notebookId}/messages`, expect.objectContaining({ method: 'DELETE' })],
      ]);
      expect(await screen.findByText('Frag deine Quellen')).toBeVisible();
    });

    it('keeps the dialog open and shows the error when deleting fails', async () => {
      api.messages = storedExchange('Was steht drin?', 'Eine Zusammenfassung.');
      api.onClear = () =>
        Promise.reject(new ApiError(500, 'Der Verlauf konnte nicht gelöscht werden.'));
      renderPanel();
      const { user, dialog } = await openDialog();

      await user.click(within(dialog).getByRole('button', { name: 'Löschen' }));

      expect(await within(dialog).findByRole('alert')).toHaveTextContent(
        'Der Verlauf konnte nicht gelöscht werden.',
      );
    });
  });
});
