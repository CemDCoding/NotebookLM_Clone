import { Logger } from '@nestjs/common';
import { type ChatEvent, ChatEventSchema, ErrorCode, MessageSchema } from '@notebooklm/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DomainError, LimitExceededError, NotFoundError } from '../common/errors';
import type { AppConfigService } from '../config';
import type { LimitsService } from '../limits/limits.service';
import type { ChatProvider, ChatStreamRequest } from '../llm/chat.provider';
import { ModelRegistry, UnknownModelError } from '../llm/model-registry';
import type { RetrievedChunk } from '../retrieval/retrieval.repository';
import type { RetrieveInput, RetrievalService } from '../retrieval/retrieval.service';
import { NoReadySourcesError } from './chat.errors';
import type {
  ChatRepository,
  CitedSection,
  MessageRecord,
  NewAnswer,
  NewMessage,
} from './chat.repository';
import { ChatService } from './chat.service';
import type { HistoryMessage } from './prompt';
import { toExcerpt } from './resolve-citations';

const USER = '0b6c3f1e-1d2a-4c3b-9e4f-5a6b7c8d9e0f';
const OTHER_USER = '7d8e9f0a-1b2c-4d3e-8f4a-5b6c7d8e9f0a';
const NOTEBOOK = '3a4b5c6d-7e8f-4a0b-9c1d-2e3f4a5b6c7d';
const OTHER_NOTEBOOK = '9f8e7d6c-5b4a-4c2d-8e1f-0a9b8c7d6e5f';
const SOURCE = '00000000-0000-4000-8000-00000000000a';

const retrievedChunks: RetrievedChunk[] = [
  {
    chunkId: '00000000-0000-4000-8000-000000000001',
    sourceId: SOURCE,
    sourceTitle: 'Handbuch.pdf',
    page: 3,
    content: 'Die Frist endet am 31. März.',
  },
  {
    chunkId: '00000000-0000-4000-8000-000000000002',
    sourceId: SOURCE,
    sourceTitle: 'Handbuch.pdf',
    page: 4,
    content: 'Anträge gehen an das Bürgeramt.',
  },
];

type PublicApi<T> = { [K in keyof T]: T[K] };

interface StoredMessage extends MessageRecord {
  userId: string;
  notebookId: string;
}

/** In-memory `ChatRepository` with the same contract: every method filters by user and notebook. */
class InMemoryChat implements PublicApi<ChatRepository> {
  readonly rows: StoredMessage[] = [];
  readonly sections: CitedSection[] = [];
  readonly notebooks = new Set([`${USER}/${NOTEBOOK}`, `${OTHER_USER}/${OTHER_NOTEBOOK}`]);
  failNextSave = false;
  private nextId = 1;

  notebookExists(userId: string, notebookId: string): Promise<boolean> {
    return Promise.resolve(this.notebooks.has(`${userId}/${notebookId}`));
  }

  list(userId: string, notebookId: string): Promise<MessageRecord[]> {
    return Promise.resolve(
      this.owned(userId, notebookId).sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()),
    );
  }

  async listRecent(userId: string, notebookId: string, limit: number): Promise<HistoryMessage[]> {
    const all = await this.list(userId, notebookId);
    return all.slice(-limit).map(({ role, content }) => ({ role, content }));
  }

  saveExchange(
    userId: string,
    notebookId: string,
    question: NewMessage,
    answer: NewAnswer,
  ): Promise<string> {
    if (this.failNextSave) {
      this.failNextSave = false;
      return Promise.reject(new Error('Database unavailable'));
    }
    const base = { userId, notebookId, citations: [] as unknown[], model: null };
    this.rows.push({ ...base, ...question, id: this.id(), role: 'user' });
    const id = this.id();
    this.rows.push({ ...base, ...answer, citations: [...answer.citations], id, role: 'assistant' });
    return Promise.resolve(id);
  }

  deleteAll(userId: string, notebookId: string): Promise<number> {
    const owned = new Set(this.owned(userId, notebookId));
    const before = this.rows.length;
    this.rows.splice(0, this.rows.length, ...this.rows.filter((row) => !owned.has(row)));
    return Promise.resolve(before - this.rows.length);
  }

  findSections(
    _userId: string,
    _notebookId: string,
    chunkIds: readonly string[],
  ): Promise<CitedSection[]> {
    return Promise.resolve(this.sections.filter((section) => chunkIds.includes(section.chunkId)));
  }

  /** Adds a stored message directly, e.g. one written by an earlier version. */
  add(message: Omit<StoredMessage, 'id'>): string {
    const id = this.id();
    this.rows.push({ ...message, id });
    return id;
  }

  private owned(userId: string, notebookId: string): StoredMessage[] {
    return this.rows.filter((row) => row.userId === userId && row.notebookId === notebookId);
  }

  private id(): string {
    return `00000000-0000-4000-8000-${String(this.nextId++).padStart(12, '0')}`;
  }
}

class FakeRetrieval implements Pick<RetrievalService, 'retrieve' | 'hasReadyActiveSources'> {
  hasSources = true;
  chunks = retrievedChunks;
  failNext = false;
  readonly calls: RetrieveInput[] = [];

  retrieve(input: RetrieveInput): Promise<RetrievedChunk[]> {
    this.calls.push(input);
    if (this.failNext) {
      return Promise.reject(new Error('Embedding failed'));
    }
    return Promise.resolve(this.chunks);
  }

  hasReadyActiveSources(): Promise<boolean> {
    return Promise.resolve(this.hasSources);
  }
}

class FakeLimits implements Pick<LimitsService, 'acceptChat'> {
  accepted = 0;
  exceeded = false;

  acceptChat(): Promise<void> {
    if (this.exceeded) {
      return Promise.reject(new LimitExceededError('Du hast das Stundenlimit erreicht.'));
    }
    this.accepted++;
    return Promise.resolve();
  }
}

class FakeProvider implements ChatProvider {
  tokens = ['Die Frist endet am 31. März ', '[1].'];
  failAfterTokens: number | undefined;
  readonly requests: ChatStreamRequest[] = [];

  async *stream(request: ChatStreamRequest): AsyncGenerator<string> {
    this.requests.push(request);
    for (const [index, token] of this.tokens.entries()) {
      if (index === this.failAfterTokens) {
        throw new Error('Provider overloaded');
      }
      request.signal.throwIfAborted();
      await Promise.resolve();
      yield token;
    }
  }
}

interface Fixture {
  service: ChatService;
  repository: InMemoryChat;
  retrieval: FakeRetrieval;
  limits: FakeLimits;
  provider: FakeProvider;
  providerFor: string[];
}

function createService(): Fixture {
  const repository = new InMemoryChat();
  const retrieval = new FakeRetrieval();
  const limits = new FakeLimits();
  const provider = new FakeProvider();
  const providerFor: string[] = [];
  const config: Pick<AppConfigService, 'chatModels' | 'ollama'> = {
    chatModels: ['mistral-small-latest', 'ministral-8b-latest'],
    ollama: { baseUrl: 'http://localhost:11434/v1', chatModels: ['llama3.2'] },
  };
  const service = new ChatService(
    repository as unknown as ChatRepository,
    new ModelRegistry(config as AppConfigService),
    retrieval as unknown as RetrievalService,
    limits as unknown as LimitsService,
    (name) => {
      providerFor.push(name);
      return provider;
    },
  );
  return { service, repository, retrieval, limits, provider, providerFor };
}

async function caught(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error('expected the promise to reject');
}

async function collect(events: AsyncIterable<ChatEvent>): Promise<ChatEvent[]> {
  const all: ChatEvent[] = [];
  for await (const event of events) {
    all.push(ChatEventSchema.parse(event));
  }
  return all;
}

describe('ChatService', () => {
  let f: Fixture;

  beforeEach(() => {
    vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    f = createService();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  async function ask(question = 'Wann endet die Frist?', model?: string): Promise<ChatEvent[]> {
    const accepted = await f.service.accept(USER, NOTEBOOK, { question, model });
    return collect(f.service.answer(accepted, new AbortController().signal));
  }

  describe('accept', () => {
    it('answers 404 for a notebook of another user before anything else', async () => {
      const error = await caught(f.service.accept(USER, OTHER_NOTEBOOK, { question: 'x' }));

      expect(error).toBeInstanceOf(NotFoundError);
      expect(f.limits.accepted).toBe(0);
    });

    it('rejects an unknown model with 400 and uses no quota', async () => {
      const error = await caught(
        f.service.accept(USER, NOTEBOOK, { question: 'x', model: 'gpt-4' }),
      );

      expect(error).toBeInstanceOf(UnknownModelError);
      expect(f.limits.accepted).toBe(0);
    });

    it('answers 409 NO_READY_SOURCES without quota and without any model call', async () => {
      f.retrieval.hasSources = false;

      const error = await caught(f.service.accept(USER, NOTEBOOK, { question: 'x' }));

      expect(error).toBeInstanceOf(NoReadySourcesError);
      expect((error as DomainError).statusCode).toBe(409);
      expect((error as DomainError).code).toBe(ErrorCode.NO_READY_SOURCES);
      expect(f.limits.accepted).toBe(0);
      expect(f.retrieval.calls).toEqual([]);
      expect(f.provider.requests).toEqual([]);
    });

    it('passes the limit error on and calls no model', async () => {
      f.limits.exceeded = true;

      const error = await caught(f.service.accept(USER, NOTEBOOK, { question: 'x' }));

      expect(error).toBeInstanceOf(LimitExceededError);
      expect(f.provider.requests).toEqual([]);
    });

    it('resolves the default model without a choice and records the usage event', async () => {
      const accepted = await f.service.accept(USER, NOTEBOOK, { question: 'Wann?' });

      expect(accepted.model.id).toBe('mistral-small-latest');
      expect(f.limits.accepted).toBe(1);
    });
  });

  describe('answer', () => {
    it('streams tokens, then the resolved citations, then done', async () => {
      const events = await ask();

      expect(events.map((event) => event.type)).toEqual(['token', 'token', 'citations', 'done']);
      expect(events.slice(0, 2)).toEqual([
        { type: 'token', text: 'Die Frist endet am 31. März ' },
        { type: 'token', text: '[1].' },
      ]);
      const chunk = retrievedChunks[0];
      expect(events[2]).toEqual({
        type: 'citations',
        citations: [
          {
            n: 1,
            sourceId: SOURCE,
            chunkId: chunk?.chunkId,
            page: 3,
            available: true,
            sourceTitle: 'Handbuch.pdf',
            excerpt: toExcerpt(chunk?.content ?? ''),
            content: chunk?.content,
          },
        ],
      });
    });

    it('saves question and answer only after done, with references only', async () => {
      const events = await ask();
      const done = events.at(-1);

      expect(f.repository.rows.map((row) => row.role)).toEqual(['user', 'assistant']);
      const [question, answer] = f.repository.rows;
      expect(question).toMatchObject({ content: 'Wann endet die Frist?', model: null });
      expect(answer).toMatchObject({
        content: 'Die Frist endet am 31. März [1].',
        model: 'mistral-small-latest',
      });
      expect(answer?.citations).toEqual([
        { n: 1, sourceId: SOURCE, chunkId: retrievedChunks[0]?.chunkId, page: 3 },
      ]);
      expect(done).toEqual({ type: 'done', messageId: answer?.id, model: 'mistral-small-latest' });
    });

    it('drops markers without a chunk', async () => {
      f.provider.tokens = ['Erfunden [99], belegt [2].'];

      const events = await ask();

      const citations = events.find((event) => event.type === 'citations');
      expect(citations?.type === 'citations' && citations.citations.map((c) => c.n)).toEqual([2]);
      expect(f.repository.rows[1]?.citations).toHaveLength(1);
    });

    it('gives the question an earlier timestamp than its answer, so the history keeps their order', async () => {
      vi.useFakeTimers({ now: new Date('2026-10-23T10:00:00.000Z'), toFake: ['Date'] });
      try {
        await ask();
      } finally {
        vi.useRealTimers();
      }

      const [question, answer] = f.repository.rows;
      expect(question?.createdAt.toISOString()).toBe('2026-10-23T10:00:00.000Z');
      expect(answer?.createdAt.getTime()).toBeGreaterThan(question?.createdAt.getTime() ?? 0);
      const history = await f.service.listMessages(USER, NOTEBOOK);
      expect(history.map((message) => message.role)).toEqual(['user', 'assistant']);
    });

    it('stores and reports the registry id of an Ollama model, but sends its plain name', async () => {
      const events = await ask('Wann?', 'ollama:llama3.2');

      expect(f.providerFor).toEqual(['ollama']);
      expect(f.provider.requests[0]?.model).toBe('llama3.2');
      expect(events.at(-1)).toMatchObject({ type: 'done', model: 'ollama:llama3.2' });
      expect(f.repository.rows[1]?.model).toBe('ollama:llama3.2');
    });

    it('builds the prompt from the last six messages and searches with the last question', async () => {
      const at = (minute: number) => new Date(Date.UTC(2026, 9, 23, 9, minute));
      for (let i = 0; i < 8; i++) {
        f.repository.add({
          userId: USER,
          notebookId: NOTEBOOK,
          role: i % 2 === 0 ? 'user' : 'assistant',
          content: `Nachricht ${i}`,
          model: null,
          citations: [],
          createdAt: at(i),
        });
      }

      await ask('Und der zweite Punkt?');

      const messages = f.provider.requests[0]?.messages ?? [];
      expect(messages.slice(1).map((message) => message.content)).toEqual([
        'Nachricht 2',
        'Nachricht 3',
        'Nachricht 4',
        'Nachricht 5',
        'Nachricht 6',
        'Nachricht 7',
        'Und der zweite Punkt?',
      ]);
      expect(f.retrieval.calls[0]).toMatchObject({
        userId: USER,
        notebookId: NOTEBOOK,
        question: 'Und der zweite Punkt?',
        previousUserQuestion: 'Nachricht 6',
      });
    });

    it('hands the abort signal to retrieval and provider', async () => {
      const signal = new AbortController().signal;
      const accepted = await f.service.accept(USER, NOTEBOOK, { question: 'Wann?' });

      await collect(f.service.answer(accepted, signal));

      expect(f.retrieval.calls[0]?.signal).toBe(signal);
      expect(f.provider.requests[0]?.signal).toBe(signal);
    });

    it('reports a provider failure as MODEL_UNAVAILABLE and saves nothing', async () => {
      f.provider.failAfterTokens = 1;

      const events = await ask();

      expect(events.map((event) => event.type)).toEqual(['token', 'error']);
      expect(events.at(-1)).toMatchObject({ type: 'error', code: 'MODEL_UNAVAILABLE' });
      expect(f.repository.rows).toEqual([]);
      expect(f.limits.accepted).toBe(1);
    });

    it('treats an empty answer as a model failure', async () => {
      f.provider.tokens = ['  '];

      const events = await ask();

      expect(events.at(-1)).toMatchObject({ type: 'error', code: 'MODEL_UNAVAILABLE' });
      expect(f.repository.rows).toEqual([]);
    });

    it('reports a retrieval failure as STREAM_FAILED without calling the model', async () => {
      f.retrieval.failNext = true;

      const events = await ask();

      expect(events).toEqual([
        {
          type: 'error',
          code: 'STREAM_FAILED',
          message: 'Die Antwort konnte nicht erzeugt werden. Bitte versuche es erneut.',
        },
      ]);
      expect(f.provider.requests).toEqual([]);
    });

    it('reports a failed save as STREAM_FAILED instead of done', async () => {
      f.repository.failNextSave = true;

      const events = await ask();

      expect(events.map((event) => event.type)).toEqual(['token', 'token', 'citations', 'error']);
      expect(events.at(-1)).toMatchObject({ code: 'STREAM_FAILED' });
    });

    it('never puts provider details into the error event', async () => {
      f.provider.failAfterTokens = 0;

      const events = await ask();

      expect(JSON.stringify(events)).not.toContain('overloaded');
    });

    it('ends without an error event and saves nothing when aborted', async () => {
      const abort = new AbortController();
      const accepted = await f.service.accept(USER, NOTEBOOK, { question: 'Wann?' });
      const events: ChatEvent[] = [];

      for await (const event of f.service.answer(accepted, abort.signal)) {
        events.push(event);
        abort.abort();
      }

      expect(events.map((event) => event.type)).toEqual(['token']);
      expect(f.repository.rows).toEqual([]);
      expect(f.limits.accepted).toBe(1);
    });

    it('saves nothing when the client leaves while the citations are sent', async () => {
      const abort = new AbortController();
      const accepted = await f.service.accept(USER, NOTEBOOK, { question: 'Wann?' });
      const types: string[] = [];

      for await (const event of f.service.answer(accepted, abort.signal)) {
        types.push(event.type);
        if (event.type === 'citations') {
          abort.abort();
        }
      }

      expect(types).toEqual(['token', 'token', 'citations']);
      expect(f.repository.rows).toEqual([]);
    });
  });

  describe('listMessages', () => {
    const answerAt = new Date('2026-10-23T10:00:01.000Z');

    function addAnswer(citations: unknown[]): string {
      return f.repository.add({
        userId: USER,
        notebookId: NOTEBOOK,
        role: 'assistant',
        content: 'Antwort [1] [2].',
        model: 'mistral-small-latest',
        citations,
        createdAt: answerAt,
      });
    }

    it('answers 404 for a notebook of another user', async () => {
      expect(await caught(f.service.listMessages(USER, OTHER_NOTEBOOK))).toBeInstanceOf(
        NotFoundError,
      );
    });

    it('resolves stored references live and marks missing chunks as unavailable', async () => {
      const kept = { n: 1, sourceId: SOURCE, chunkId: retrievedChunks[0]?.chunkId, page: 3 };
      const deleted = { n: 2, sourceId: SOURCE, chunkId: retrievedChunks[1]?.chunkId, page: 4 };
      const content = 'Die Frist endet am 31. März. '.repeat(30);
      f.repository.sections.push({
        chunkId: kept.chunkId ?? '',
        sourceId: SOURCE,
        title: 'Handbuch.pdf',
        content,
      });
      addAnswer([kept, deleted]);

      const [message] = await f.service.listMessages(USER, NOTEBOOK);

      expect(message?.citations).toEqual([
        {
          ...kept,
          available: true,
          sourceTitle: 'Handbuch.pdf',
          excerpt: toExcerpt(content),
          content,
        },
        { ...deleted, available: false },
      ]);
      expect(MessageSchema.parse(message)).toEqual(message);
    });

    it('returns createdAt in the UTC form MessageSchema accepts', async () => {
      addAnswer([]);

      const [message] = await f.service.listMessages(USER, NOTEBOOK);

      expect(message?.createdAt).toBe('2026-10-23T10:00:01.000Z');
    });

    it('drops invalid stored citations and logs only the message id', async () => {
      const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
      const valid = { n: 1, sourceId: SOURCE, chunkId: retrievedChunks[0]?.chunkId, page: 3 };
      const id = addAnswer([valid, { n: 'zwei', secret: 'Vertraulicher Text' }]);

      const [message] = await f.service.listMessages(USER, NOTEBOOK);

      expect(message?.citations).toEqual([{ ...valid, available: false }]);
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn).toHaveBeenCalledWith({
        message: 'Dropped invalid stored citations',
        messageId: id,
      });
      expect(JSON.stringify(warn.mock.calls)).not.toContain('Vertraulicher');
    });
  });

  describe('clearMessages', () => {
    it('deletes the history of the notebook only', async () => {
      await ask();
      f.repository.add({
        userId: OTHER_USER,
        notebookId: OTHER_NOTEBOOK,
        role: 'user',
        content: 'Fremd',
        model: null,
        citations: [],
        createdAt: new Date(),
      });

      await f.service.clearMessages(USER, NOTEBOOK);

      expect(await f.service.listMessages(USER, NOTEBOOK)).toEqual([]);
      expect(f.repository.rows).toHaveLength(1);
    });

    it('answers 404 for a notebook of another user and deletes nothing', async () => {
      f.repository.add({
        userId: OTHER_USER,
        notebookId: OTHER_NOTEBOOK,
        role: 'user',
        content: 'Fremd',
        model: null,
        citations: [],
        createdAt: new Date(),
      });

      expect(await caught(f.service.clearMessages(USER, OTHER_NOTEBOOK))).toBeInstanceOf(
        NotFoundError,
      );
      expect(f.repository.rows).toHaveLength(1);
    });
  });
});
