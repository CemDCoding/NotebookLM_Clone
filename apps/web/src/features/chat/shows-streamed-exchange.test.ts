import type { Message } from '@notebooklm/shared';
import { describe, expect, it } from 'vitest';
import { showsStreamedExchange } from './shows-streamed-exchange';

const messageId = '3c9e1f2a-4b5d-4e6f-8a7b-9c0d1e2f3a4b';

const storedAnswer: Message = {
  id: messageId,
  role: 'assistant',
  content: 'Antwort',
  model: 'mistral-small-latest',
  citations: [],
  createdAt: '2026-10-23T10:00:00.000Z',
};

describe('showsStreamedExchange', () => {
  it('shows nothing before the first question', () => {
    expect(showsStreamedExchange({ status: 'idle', messageId: null }, [], false)).toBe(false);
  });

  it.each(['streaming', 'aborted', 'error'] as const)('shows a %s answer', (status) => {
    expect(showsStreamedExchange({ status, messageId: null }, [storedAnswer], false)).toBe(true);
  });

  it('keeps a finished answer until the history contains it', () => {
    const stream = { status: 'done', messageId } as const;

    expect(showsStreamedExchange(stream, [], false)).toBe(true);
    expect(showsStreamedExchange(stream, undefined, false)).toBe(true);
    expect(showsStreamedExchange(stream, [storedAnswer], false)).toBe(false);
  });

  it('hides the exchange after the history was cleared', () => {
    expect(showsStreamedExchange({ status: 'done', messageId }, [], true)).toBe(false);
    expect(showsStreamedExchange({ status: 'aborted', messageId: null }, [], true)).toBe(false);
  });
});
