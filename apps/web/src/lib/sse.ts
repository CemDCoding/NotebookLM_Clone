import { ChatEventSchema, type ChatEvent } from '@notebooklm/shared';

/** The stream broke the SSE format or carried an event outside the chat contract. */
export class SseProtocolError extends Error {
  override readonly name = 'SseProtocolError';
}

/**
 * Reads the chat stream frame by frame and hands every event, validated against the shared
 * schema, to `onEvent`. Resolves when the server closes the stream. An abort of the underlying
 * `fetch` rejects with the abort error unchanged.
 *
 * `EventSource` is not used because it cannot send the `Authorization` header.
 */
export async function readSseStream(
  response: Response,
  onEvent: (event: ChatEvent) => void,
): Promise<void> {
  if (!response.body) {
    throw new SseProtocolError('Response has no body to read');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    for (;;) {
      const { done, value } = await reader.read();
      // `stream: true` keeps a multi-byte character that is split across chunks intact.
      buffer += decoder.decode(value, { stream: !done });
      // A trailing `\r` may be the first half of a `\r\n` split across chunks; normalising it
      // now would turn that pair into two line breaks and end the frame early.
      const heldBack = !done && buffer.endsWith('\r') ? '\r' : '';
      buffer = buffer.slice(0, buffer.length - heldBack.length).replace(/\r\n?/g, '\n');

      // A frame ends with a blank line; whatever follows the last one is still incomplete.
      let boundary = buffer.indexOf('\n\n');
      while (boundary !== -1) {
        const event = parseFrame(buffer.slice(0, boundary));
        buffer = buffer.slice(boundary + 2);
        if (event) {
          onEvent(event);
        }
        boundary = buffer.indexOf('\n\n');
      }
      buffer += heldBack;

      if (done) {
        // The SSE spec discards an unterminated frame at the end of the stream.
        return;
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/** Returns `null` for frames without data, e.g. keep-alive comments. */
function parseFrame(frame: string): ChatEvent | null {
  let eventName: string | undefined;
  const dataLines: string[] = [];

  for (const line of frame.split('\n')) {
    if (line === '' || line.startsWith(':')) {
      continue;
    }
    const colon = line.indexOf(':');
    const field = colon === -1 ? line : line.slice(0, colon);
    // A single space after the colon is part of the syntax, not of the value.
    const value = colon === -1 ? '' : line.slice(colon + 1).replace(/^ /, '');
    if (field === 'event') {
      eventName = value;
    } else if (field === 'data') {
      dataLines.push(value);
    }
  }

  if (dataLines.length === 0) {
    return null;
  }

  let json: unknown;
  try {
    json = JSON.parse(dataLines.join('\n'));
  } catch (error) {
    throw new SseProtocolError('Event data is not valid JSON', { cause: error });
  }
  const parsed = ChatEventSchema.safeParse(json);
  if (!parsed.success) {
    throw new SseProtocolError('Event does not match the chat contract', { cause: parsed.error });
  }
  if (eventName !== undefined && eventName !== parsed.data.type) {
    throw new SseProtocolError(`Event name "${eventName}" does not match its type`);
  }
  return parsed.data;
}
