import { APIError, APIUserAbortError } from 'openai';
import { describe, expect, it, vi } from 'vitest';
import type { ChatMessage } from './chat.provider';
import {
  type ChatCompletionsClient,
  OpenAiCompatibleChatProvider,
} from './openai-compatible-chat.provider';

interface CreateBody {
  model: string;
  messages: ChatMessage[];
  stream: boolean;
}
interface CreateOptions {
  signal?: AbortSignal;
}
interface FakeChunk {
  choices: { delta: { content?: string | null } }[];
}

const chunk = (content: string | null): FakeChunk => ({ choices: [{ delta: { content } }] });

const MESSAGES: ChatMessage[] = [
  { role: 'system', content: 'Antworte auf Deutsch.' },
  { role: 'user', content: 'Worum geht es?' },
];

/**
 * A stream like the SDK's: it yields the given chunks and, when the request's
 * signal fires, stops with the SDK's abort error. `ignoreSignal` simulates a
 * provider that keeps sending regardless.
 */
function fakeClient(chunks: FakeChunk[], { ignoreSignal = false } = {}) {
  const create = vi.fn((_body: CreateBody, options?: CreateOptions) =>
    Promise.resolve(
      (async function* () {
        for (const item of chunks) {
          await Promise.resolve();
          if (!ignoreSignal && options?.signal?.aborted) {
            throw new APIUserAbortError();
          }
          yield item;
        }
      })(),
    ),
  );
  const client = { chat: { completions: { create } } } as unknown as ChatCompletionsClient;
  return { create, provider: new OpenAiCompatibleChatProvider(client) };
}

async function collect(iterable: AsyncIterable<string>): Promise<string[]> {
  const tokens: string[] = [];
  for await (const token of iterable) {
    tokens.push(token);
  }
  return tokens;
}

describe('OpenAiCompatibleChatProvider', () => {
  it('streams the model, messages and signal to the client and yields the text pieces', async () => {
    const { create, provider } = fakeClient([
      chunk('Hallo'),
      chunk(null),
      chunk(' Welt'),
      chunk(''),
    ]);
    const signal = new AbortController().signal;

    const tokens = await collect(
      provider.stream({ model: 'mistral-small-latest', messages: MESSAGES, signal }),
    );

    expect(tokens).toEqual(['Hallo', ' Welt']);
    expect(create).toHaveBeenCalledWith(
      { model: 'mistral-small-latest', messages: MESSAGES, stream: true },
      { signal },
    );
  });

  it('skips chunks without choices', async () => {
    const { provider } = fakeClient([{ choices: [] }, chunk('Text')]);

    const tokens = await collect(
      provider.stream({ model: 'm', messages: MESSAGES, signal: new AbortController().signal }),
    );

    expect(tokens).toEqual(['Text']);
  });

  it.each([
    ['a stream that honours the signal', false],
    ['a stream that ignores the signal', true],
  ])('ends the iteration with the abort reason for %s', async (_case, ignoreSignal) => {
    const { provider } = fakeClient([chunk('Eins'), chunk('Zwei'), chunk('Drei')], {
      ignoreSignal,
    });
    const controller = new AbortController();
    const tokens: string[] = [];

    const run = (async () => {
      for await (const token of provider.stream({
        model: 'm',
        messages: MESSAGES,
        signal: controller.signal,
      })) {
        tokens.push(token);
        controller.abort();
      }
    })();

    // The reason exists only once the loop has aborted, so read it afterwards.
    const error = await run.then(
      () => undefined,
      (reason: unknown) => reason,
    );
    expect(error).toBe(controller.signal.reason);
    expect(error).toMatchObject({ name: 'AbortError' });
    expect(tokens).toEqual(['Eins']);
  });

  it('makes no request when the signal is already aborted', async () => {
    const { create, provider } = fakeClient([chunk('Text')]);
    const controller = new AbortController();
    controller.abort();

    await expect(
      collect(provider.stream({ model: 'm', messages: MESSAGES, signal: controller.signal })),
    ).rejects.toBe(controller.signal.reason);
    expect(create).not.toHaveBeenCalled();
  });

  it('passes provider errors on without retrying', async () => {
    const failure = new APIError(429, undefined, 'rate limited', undefined);
    const create = vi.fn(() => Promise.reject(failure));
    const client = { chat: { completions: { create } } } as unknown as ChatCompletionsClient;
    const provider = new OpenAiCompatibleChatProvider(client);

    await expect(
      collect(
        provider.stream({ model: 'm', messages: MESSAGES, signal: new AbortController().signal }),
      ),
    ).rejects.toBe(failure);
    expect(create).toHaveBeenCalledTimes(1);
  });
});
