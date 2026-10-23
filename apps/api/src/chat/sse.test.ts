import { type ChatEvent, ChatEventSchema } from '@notebooklm/shared';
import { describe, expect, it } from 'vitest';
import { toSseFrame } from './sse';

function parse(frame: string): { name: string; data: unknown } {
  const [eventLine, dataLine, ...rest] = frame.split('\n');
  expect(rest).toEqual(['', '']);
  return {
    name: eventLine?.replace(/^event: /, '') ?? '',
    data: JSON.parse(dataLine?.replace(/^data: /, '') ?? ''),
  };
}

describe('toSseFrame', () => {
  it.each<ChatEvent>([
    { type: 'token', text: 'Zeile eins\nZeile zwei' },
    { type: 'citations', citations: [] },
    { type: 'done', messageId: '3f6c1f0e-8b2a-4c1d-9e57-2a4b6d8f0a11', model: 'ollama:llama3.2' },
    { type: 'error', code: 'STREAM_FAILED', message: 'Fehler.' },
  ])('names the frame after the type and sends the whole event as data: $type', (event) => {
    const frame = toSseFrame(event);
    const { name, data } = parse(frame);

    expect(frame.endsWith('\n\n')).toBe(true);
    expect(name).toBe(event.type);
    expect(ChatEventSchema.parse(data)).toEqual(event);
  });

  it('refuses an event that breaks the contract', () => {
    const invalid = { type: 'done', messageId: 'abc', model: '' } as unknown as ChatEvent;
    expect(() => toSseFrame(invalid)).toThrow();
  });
});
