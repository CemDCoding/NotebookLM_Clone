import { APIError } from 'openai';
import { describe, expect, it, vi } from 'vitest';
import { EMBEDDING_DIMENSIONS } from '../db/schema';
import { EMBEDDING_MODEL, EmbeddingResponseError } from './embedding.provider';
import {
  EMBEDDING_BATCH_SIZE,
  type EmbeddingsClient,
  OpenAiCompatibleEmbeddingProvider,
} from './openai-compatible-embedding.provider';

interface CreateBody {
  model: string;
  input: string[];
  encoding_format: string;
}
interface CreateOptions {
  signal?: AbortSignal;
}
interface FakeResponse {
  data: { index: number; embedding: number[] }[];
}

/** A vector whose first entry identifies the text, so order can be checked. */
const vectorFor = (text: string, dimensions = EMBEDDING_DIMENSIONS): number[] => {
  const vector = new Array<number>(dimensions).fill(0);
  vector[0] = Number(text.replace('text-', ''));
  return vector;
};

const respond = (body: CreateBody, dimensions?: number): FakeResponse => ({
  data: body.input.map((text, index) => ({ index, embedding: vectorFor(text, dimensions) })),
});

function fakeClient(
  create: (body: CreateBody, options?: CreateOptions) => Promise<FakeResponse> = (body) =>
    Promise.resolve(respond(body)),
) {
  const spy = vi.fn(create);
  const client = { embeddings: { create: spy } } as unknown as EmbeddingsClient;
  // No real waiting between retries.
  const provider = new OpenAiCompatibleEmbeddingProvider(client, {
    backoff: { sleep: () => Promise.resolve() },
  });
  return { create: spy, provider };
}

const texts = (count: number): string[] =>
  Array.from({ length: count }, (_, index) => `text-${index}`);

describe('OpenAiCompatibleEmbeddingProvider', () => {
  it('embeds with mistral-embed as floats', async () => {
    const { create, provider } = fakeClient();

    await provider.embed(texts(2));

    expect(create).toHaveBeenCalledWith(
      { model: EMBEDDING_MODEL, input: ['text-0', 'text-1'], encoding_format: 'float' },
      expect.anything(),
    );
  });

  it('splits the input into batches of 16 and keeps the order', async () => {
    const { create, provider } = fakeClient();

    const vectors = await provider.embed(texts(35));

    expect(create.mock.calls.map(([body]) => body.input.length)).toEqual([16, 16, 3]);
    expect(EMBEDDING_BATCH_SIZE).toBe(16);
    expect(vectors).toHaveLength(35);
    expect(vectors.map((vector) => vector[0])).toEqual(texts(35).map((_, index) => index));
  });

  it('makes no request for an empty input', async () => {
    const { create, provider } = fakeClient();

    await expect(provider.embed([])).resolves.toEqual([]);
    expect(create).not.toHaveBeenCalled();
  });

  it('orders vectors by their index, not by response order', async () => {
    const { provider } = fakeClient((body) =>
      Promise.resolve({ data: respond(body).data.reverse() }),
    );

    const vectors = await provider.embed(texts(3));

    expect(vectors.map((vector) => vector[0])).toEqual([0, 1, 2]);
  });

  it('retries a batch after 429 without repeating finished batches', async () => {
    let calls = 0;
    const { create, provider } = fakeClient((body) => {
      calls++;
      if (calls === 2) {
        return Promise.reject(APIError.generate(429, undefined, 'rate limited', new Headers()));
      }
      return Promise.resolve(respond(body));
    });

    const vectors = await provider.embed(texts(20));

    expect(vectors).toHaveLength(20);
    expect(create.mock.calls.map(([body]) => body.input[0])).toEqual([
      'text-0',
      'text-16',
      'text-16',
    ]);
  });

  it('gives up after 5 attempts on persistent 429', async () => {
    const { create, provider } = fakeClient(() =>
      Promise.reject(APIError.generate(429, undefined, 'rate limited', new Headers())),
    );

    await expect(provider.embed(texts(1))).rejects.toThrow(APIError);
    expect(create).toHaveBeenCalledTimes(5);
  });

  it('rejects vectors with the wrong dimension', async () => {
    const { provider } = fakeClient((body) => Promise.resolve(respond(body, 768)));

    await expect(provider.embed(texts(1))).rejects.toThrow(EmbeddingResponseError);
    await expect(provider.embed(texts(1))).rejects.toThrow('Expected 1024 dimensions');
  });

  it('rejects a response with missing vectors', async () => {
    const { provider } = fakeClient((body) =>
      Promise.resolve({ data: respond(body).data.slice(1) }),
    );

    await expect(provider.embed(texts(2))).rejects.toThrow(EmbeddingResponseError);
  });

  it('rejects duplicate or out-of-range indexes', async () => {
    const duplicate = fakeClient(() =>
      Promise.resolve({
        data: [
          { index: 0, embedding: vectorFor('text-0') },
          { index: 0, embedding: vectorFor('text-1') },
        ],
      }),
    );
    const outOfRange = fakeClient(() =>
      Promise.resolve({
        data: [
          { index: 0, embedding: vectorFor('text-0') },
          { index: 2, embedding: vectorFor('text-1') },
        ],
      }),
    );

    await expect(duplicate.provider.embed(texts(2))).rejects.toThrow(EmbeddingResponseError);
    await expect(outOfRange.provider.embed(texts(2))).rejects.toThrow(EmbeddingResponseError);
  });

  it('never puts input text into error messages', async () => {
    const { provider } = fakeClient((body) => Promise.resolve(respond(body, 3)));

    const error = await provider.embed(['text-42']).catch((caught: unknown) => caught);

    expect(String(error)).not.toContain('text-42');
  });

  it('passes the abort signal to the request', async () => {
    const controller = new AbortController();
    const { create, provider } = fakeClient();

    await provider.embed(texts(1), controller.signal);

    expect(create.mock.calls[0]?.[1]).toEqual({ signal: controller.signal });
  });

  it('sends no further batch once aborted', async () => {
    const controller = new AbortController();
    const { create, provider } = fakeClient((body) => {
      controller.abort(new Error('cancelled'));
      return Promise.resolve(respond(body));
    });

    await expect(provider.embed(texts(20), controller.signal)).rejects.toThrow('cancelled');
    expect(create).toHaveBeenCalledTimes(1);
  });
});
