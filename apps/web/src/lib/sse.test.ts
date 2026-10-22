import type { ChatEvent } from '@notebooklm/shared';
import { describe, expect, it, vi } from 'vitest';
import { readSseStream, SseProtocolError } from './sse';

const messageId = '3c9e1f2a-4b5d-4e6f-8a7b-9c0d1e2f3a4b';

function frame(event: ChatEvent): string {
  return `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
}

/** A response whose body arrives in exactly these chunks. */
function streamOf(chunks: string[], signal?: AbortSignal): Response {
  const encoder = new TextEncoder();
  let index = 0;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (signal?.aborted) {
        controller.error(signal.reason);
        return;
      }
      const chunk = chunks[index++];
      if (chunk === undefined) {
        controller.close();
      } else {
        controller.enqueue(encoder.encode(chunk));
      }
    },
  });
  return new Response(body, { headers: { 'Content-Type': 'text/event-stream' } });
}

async function collect(response: Response): Promise<ChatEvent[]> {
  const events: ChatEvent[] = [];
  await readSseStream(response, (event) => events.push(event));
  return events;
}

describe('readSseStream', () => {
  it('reads every event type of the chat contract', async () => {
    const events: ChatEvent[] = [
      { type: 'token', text: 'Hallo' },
      { type: 'citations', citations: [] },
      { type: 'done', messageId, model: 'mistral-small-latest' },
      { type: 'error', code: 'STREAM_FAILED', message: 'Die Antwort ist fehlgeschlagen.' },
    ];

    await expect(collect(streamOf(events.map(frame)))).resolves.toEqual(events);
  });

  it('reads a frame that is split across chunks', async () => {
    const text = frame({ type: 'token', text: 'Grüße [1]' });
    const chunks = [text.slice(0, 3), text.slice(3, 20), text.slice(20)];

    await expect(collect(streamOf(chunks))).resolves.toEqual([
      { type: 'token', text: 'Grüße [1]' },
    ]);
  });

  it('keeps a multi-byte character intact that is split across chunks', async () => {
    const bytes = new TextEncoder().encode(frame({ type: 'token', text: 'ü' }));
    const split = bytes.indexOf(0xc3) + 1;
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(bytes.slice(0, split));
        controller.enqueue(bytes.slice(split));
        controller.close();
      },
    });

    await expect(collect(new Response(body))).resolves.toEqual([{ type: 'token', text: 'ü' }]);
  });

  it('reads several events from one chunk', async () => {
    const chunk = frame({ type: 'token', text: 'a' }) + frame({ type: 'token', text: 'b' });

    await expect(collect(streamOf([chunk]))).resolves.toEqual([
      { type: 'token', text: 'a' },
      { type: 'token', text: 'b' },
    ]);
  });

  it('accepts CRLF line endings, also when split between \\r and \\n', async () => {
    const text = frame({ type: 'token', text: 'x' }).replace(/\n/g, '\r\n');
    const splitAt = text.indexOf('\r\n') + 1;

    await expect(collect(streamOf([text.slice(0, splitAt), text.slice(splitAt)]))).resolves.toEqual(
      [{ type: 'token', text: 'x' }],
    );
  });

  it('ignores comments and frames without data', async () => {
    const chunks = [': keep-alive\n\n', 'event: token\n\n', frame({ type: 'token', text: 'a' })];

    await expect(collect(streamOf(chunks))).resolves.toEqual([{ type: 'token', text: 'a' }]);
  });

  it('discards an unterminated frame at the end of the stream', async () => {
    const chunks = [frame({ type: 'token', text: 'a' }), 'data: {"type":"token","text":"b"}'];

    await expect(collect(streamOf(chunks))).resolves.toEqual([{ type: 'token', text: 'a' }]);
  });

  it('rejects an event of an unknown type', async () => {
    const chunks = ['event: unknown\ndata: {"type":"unknown"}\n\n'];

    await expect(collect(streamOf(chunks))).rejects.toBeInstanceOf(SseProtocolError);
  });

  it('rejects an event whose data does not match its schema', async () => {
    const chunks = ['event: done\ndata: {"type":"done","messageId":"not-a-uuid","model":"m"}\n\n'];

    await expect(collect(streamOf(chunks))).rejects.toBeInstanceOf(SseProtocolError);
  });

  it('rejects data that is not JSON', async () => {
    await expect(collect(streamOf(['data: Hallo\n\n']))).rejects.toBeInstanceOf(SseProtocolError);
  });

  it('rejects an event whose name contradicts its type', async () => {
    const chunks = [`event: done\ndata: ${JSON.stringify({ type: 'token', text: 'a' })}\n\n`];

    await expect(collect(streamOf(chunks))).rejects.toBeInstanceOf(SseProtocolError);
  });

  it('delivers the events read so far before a later event is rejected', async () => {
    const onEvent = vi.fn();
    const chunks = [frame({ type: 'token', text: 'a' }), 'data: {"type":"unknown"}\n\n'];

    await expect(readSseStream(streamOf(chunks), onEvent)).rejects.toBeInstanceOf(SseProtocolError);
    expect(onEvent).toHaveBeenCalledExactlyOnceWith({ type: 'token', text: 'a' });
  });

  it('passes an abort through as the abort error', async () => {
    const controller = new AbortController();
    const abortError = new DOMException('Aborted', 'AbortError');
    const onEvent = vi.fn(() => controller.abort(abortError));
    const response = streamOf(
      [frame({ type: 'token', text: 'a' }), frame({ type: 'token', text: 'b' })],
      controller.signal,
    );

    await expect(readSseStream(response, onEvent)).rejects.toBe(abortError);
    expect(onEvent).toHaveBeenCalledTimes(1);
  });

  it('rejects a response without a body', async () => {
    await expect(collect(new Response(null))).rejects.toBeInstanceOf(SseProtocolError);
  });
});
