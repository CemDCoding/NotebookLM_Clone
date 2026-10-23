import { ErrorCode, type ChatEvent } from '@notebooklm/shared';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api-client';
import { useChatStream } from './use-chat-stream';

const apiFetchResponse = vi.hoisted(() => vi.fn());

vi.mock('@/lib/api-client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api-client')>()),
  apiFetchResponse,
}));
vi.mock('@/lib/supabase/client', () => ({ createSupabaseBrowserClient: vi.fn() }));

const notebookId = '6f1c2b8e-3d4a-4f5b-9c6d-7e8f9a0b1c2d';
const messageId = '3c9e1f2a-4b5d-4e6f-8a7b-9c0d1e2f3a4b';

function frame(event: ChatEvent): string {
  return `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
}

/**
 * A stream the test feeds frame by frame. Like a real `fetch` body it errors with the abort
 * reason once the request signal is aborted.
 */
function controllableStream(signal: AbortSignal) {
  const encoder = new TextEncoder();
  let controller!: ReadableStreamDefaultController<Uint8Array>;
  const body = new ReadableStream<Uint8Array>({
    start(c) {
      controller = c;
    },
  });
  signal.addEventListener('abort', () => controller.error(signal.reason));
  return {
    response: new Response(body),
    push: (event: ChatEvent) => controller.enqueue(encoder.encode(frame(event))),
    close: () => controller.close(),
  };
}

/** Makes the next chat request answer with a stream the test controls. */
function nextStream() {
  let resolveStream!: (stream: ReturnType<typeof controllableStream>) => void;
  const ready = new Promise<ReturnType<typeof controllableStream>>((resolve) => {
    resolveStream = resolve;
  });
  apiFetchResponse.mockImplementationOnce(
    async (_path: string, options: { signal: AbortSignal }) => {
      const stream = controllableStream(options.signal);
      resolveStream(stream);
      return stream.response;
    },
  );
  return ready;
}

describe('useChatStream', () => {
  beforeEach(() => {
    apiFetchResponse.mockReset();
  });

  it('posts the question and model to the chat endpoint', async () => {
    const ready = nextStream();
    const { result } = renderHook(() => useChatStream(notebookId));

    act(() => result.current.send('  Worum geht es?  ', 'mistral-small-latest'));
    await ready;

    expect(apiFetchResponse).toHaveBeenCalledWith(`/notebooks/${notebookId}/chat`, {
      method: 'POST',
      body: { question: 'Worum geht es?', model: 'mistral-small-latest' },
      signal: expect.any(AbortSignal),
    });
    expect(result.current.status).toBe('streaming');
    expect(result.current.question).toBe('Worum geht es?');
  });

  it('collects tokens and citations and finishes on done', async () => {
    const onDone = vi.fn();
    const ready = nextStream();
    const { result } = renderHook(() => useChatStream(notebookId, { onDone }));

    act(() => result.current.send('Frage'));
    const stream = await ready;
    act(() => {
      stream.push({ type: 'token', text: 'Die Antwort ' });
      stream.push({ type: 'token', text: 'steht hier [1].' });
    });
    await waitFor(() => expect(result.current.text).toBe('Die Antwort steht hier [1].'));
    expect(result.current.citations).toBeNull();

    act(() => {
      stream.push({ type: 'citations', citations: [] });
      stream.push({ type: 'done', messageId, model: 'mistral-small-latest' });
      stream.close();
    });

    await waitFor(() => expect(result.current.status).toBe('done'));
    expect(result.current).toMatchObject({
      citations: [],
      messageId,
      model: 'mistral-small-latest',
      error: null,
    });
    expect(onDone).toHaveBeenCalledExactlyOnceWith({
      type: 'done',
      messageId,
      model: 'mistral-small-latest',
    });
  });

  it('marks a stopped answer as aborted without an error and aborts the request', async () => {
    const ready = nextStream();
    const { result } = renderHook(() => useChatStream(notebookId));

    act(() => result.current.send('Frage'));
    const stream = await ready;
    act(() => stream.push({ type: 'token', text: 'Teil' }));
    await waitFor(() => expect(result.current.text).toBe('Teil'));

    act(() => result.current.stop());

    expect(result.current.status).toBe('aborted');
    expect(result.current.error).toBeNull();
    expect(result.current.text).toBe('Teil');
    const signal = apiFetchResponse.mock.calls[0]?.[1].signal as AbortSignal;
    expect(signal.aborted).toBe(true);
    // The rejected read must not turn the aborted answer into an error afterwards.
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(result.current.status).toBe('aborted');
    expect(result.current.error).toBeNull();
  });

  it('aborts the request when the component unmounts', async () => {
    const ready = nextStream();
    const { result, unmount } = renderHook(() => useChatStream(notebookId));

    act(() => result.current.send('Frage'));
    await ready;
    unmount();

    const signal = apiFetchResponse.mock.calls[0]?.[1].signal as AbortSignal;
    expect(signal.aborted).toBe(true);
  });

  it('aborts the running answer when a new question is sent', async () => {
    const first = nextStream();
    const { result } = renderHook(() => useChatStream(notebookId));
    act(() => result.current.send('Erste Frage'));
    await first;

    const second = nextStream();
    act(() => result.current.send('Zweite Frage'));
    await second;

    const firstSignal = apiFetchResponse.mock.calls[0]?.[1].signal as AbortSignal;
    expect(firstSignal.aborted).toBe(true);
    expect(result.current).toMatchObject({ status: 'streaming', question: 'Zweite Frage' });
  });

  it.each([
    [409, ErrorCode.NO_READY_SOURCES, 'Aktiviere mindestens eine fertige Quelle.'],
    [429, ErrorCode.LIMIT_EXCEEDED, 'Du hast das Stundenlimit für Fragen erreicht.'],
  ])('shows the API message of a %i before the stream', async (status, code, message) => {
    apiFetchResponse.mockRejectedValueOnce(new ApiError(status, message, code));
    const { result } = renderHook(() => useChatStream(notebookId));

    act(() => result.current.send('Frage'));

    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.error).toBe(message);
  });

  it('shows the message of an error event and keeps the text so far', async () => {
    const ready = nextStream();
    const { result } = renderHook(() => useChatStream(notebookId));

    act(() => result.current.send('Frage'));
    const stream = await ready;
    act(() => {
      stream.push({ type: 'token', text: 'Teil' });
      stream.push({
        type: 'error',
        code: 'MODEL_UNAVAILABLE',
        message: 'Das Modell ist gerade nicht erreichbar.',
      });
      stream.close();
    });

    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current).toMatchObject({
      text: 'Teil',
      error: 'Das Modell ist gerade nicht erreichbar.',
    });
  });

  it('reports a stream that ends without done as an error', async () => {
    const ready = nextStream();
    const { result } = renderHook(() => useChatStream(notebookId));

    act(() => result.current.send('Frage'));
    const stream = await ready;
    act(() => {
      stream.push({ type: 'token', text: 'Teil' });
      stream.close();
    });

    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.error).toMatch(/unterbrochen/);
  });

  it('rejects an empty question without calling the API', () => {
    const { result } = renderHook(() => useChatStream(notebookId));

    act(() => result.current.send('   '));

    expect(apiFetchResponse).not.toHaveBeenCalled();
    expect(result.current.status).toBe('error');
    expect(result.current.error).toMatch(/Frage/);
  });

  it('ignores stop when no answer is running', () => {
    const { result } = renderHook(() => useChatStream(notebookId));

    act(() => result.current.stop());

    expect(result.current.status).toBe('idle');
  });
});
