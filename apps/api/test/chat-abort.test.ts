import { request as httpRequest } from 'node:http';
import type { AddressInfo } from 'node:net';
import { type INestApplication, Logger } from '@nestjs/common';
import { APP_FILTER, APP_PIPE } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import type { NextFunction, Request, Response } from 'express';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ChatController } from '../src/chat/chat.controller';
import type { ChatRepository } from '../src/chat/chat.repository';
import { ChatService } from '../src/chat/chat.service';
import { AllExceptionsFilter } from '../src/common/filters';
import { ZodValidationPipe } from '../src/common/pipes/zod-validation.pipe';
import type { AuthenticatedRequest } from '../src/common/types';
import type { AppConfigService } from '../src/config';
import type { LimitsService } from '../src/limits/limits.service';
import type { ChatProvider, ChatStreamRequest } from '../src/llm/chat.provider';
import { ModelRegistry } from '../src/llm/model-registry';
import type { RetrieveInput, RetrievalService } from '../src/retrieval/retrieval.service';

// Abort test (apps/api/CLAUDE.md "Tests"): a client that leaves mid-stream
// cancels the provider request, and nothing is written to the history, while
// the usage event stays. Runs over a real HTTP connection, because the abort
// hangs on the `close` event of the Express response.

const USER = '0b6c3f1e-1d2a-4c3b-9e4f-5a6b7c8d9e0f';
const NOTEBOOK = '3a4b5c6d-7e8f-4a0b-9c1d-2e3f4a5b6c7d';
const TEST_USER_HEADER = 'x-test-user';

/** Yields its tokens, then, if `hang` is set, waits until the request is aborted. */
class FakeProvider implements ChatProvider {
  hang = true;
  readonly requests: ChatStreamRequest[] = [];
  private resolveAborted: () => void = () => undefined;
  /** Resolves once the signal of a request was aborted. */
  readonly aborted = new Promise<void>((resolve) => {
    this.resolveAborted = resolve;
  });

  async *stream(request: ChatStreamRequest): AsyncGenerator<string> {
    this.requests.push(request);
    request.signal.addEventListener('abort', () => this.resolveAborted());
    yield 'Die Frist endet [1].';
    if (this.hang) {
      await new Promise((_resolve, reject) => {
        request.signal.addEventListener('abort', () => reject(request.signal.reason as Error));
      });
    }
  }
}

interface Harness {
  app: INestApplication;
  port: number;
  provider: FakeProvider;
  retrievals: RetrieveInput[];
  saved: unknown[];
  usageEvents: () => number;
}

async function createHarness(): Promise<Harness> {
  const provider = new FakeProvider();
  const retrievals: RetrieveInput[] = [];
  const saved: unknown[] = [];
  let usageEvents = 0;

  const repository: Partial<ChatRepository> = {
    notebookExists: (userId, notebookId) =>
      Promise.resolve(userId === USER && notebookId === NOTEBOOK),
    listRecent: () => Promise.resolve([]),
    saveExchange: (...args) => {
      saved.push(args);
      return Promise.resolve('3f6c1f0e-8b2a-4c1d-9e57-2a4b6d8f0a11');
    },
  };
  const retrieval: Pick<RetrievalService, 'retrieve' | 'hasReadyActiveSources'> = {
    hasReadyActiveSources: () => Promise.resolve(true),
    retrieve: (input) => {
      retrievals.push(input);
      return Promise.resolve([
        {
          chunkId: '00000000-0000-4000-8000-000000000001',
          sourceId: '00000000-0000-4000-8000-00000000000a',
          sourceTitle: 'Handbuch.pdf',
          page: 3,
          content: 'Die Frist endet am 31. März.',
        },
      ]);
    },
  };
  const limits: Pick<LimitsService, 'acceptChat'> = {
    acceptChat: () => {
      usageEvents++;
      return Promise.resolve();
    },
  };
  const config: Pick<AppConfigService, 'chatModels' | 'ollama'> = {
    chatModels: ['mistral-small-latest'],
    ollama: undefined,
  };
  const service = new ChatService(
    repository as ChatRepository,
    new ModelRegistry(config as AppConfigService),
    retrieval as RetrievalService,
    limits as LimitsService,
    () => provider,
  );

  const moduleRef = await Test.createTestingModule({
    controllers: [ChatController],
    providers: [
      { provide: ChatService, useValue: service },
      { provide: APP_PIPE, useClass: ZodValidationPipe },
      { provide: APP_FILTER, useClass: AllExceptionsFilter },
    ],
  }).compile();
  const app = moduleRef.createNestApplication({ logger: false });
  app.use((req: Request, _res: Response, next: NextFunction) => {
    (req as Partial<AuthenticatedRequest>).user = { id: req.header(TEST_USER_HEADER) ?? '' };
    next();
  });
  await app.listen(0, '127.0.0.1');
  const { port } = app.getHttpServer().address() as AddressInfo;
  return { app, port, provider, retrievals, saved, usageEvents: () => usageEvents };
}

/** Posts a question and calls `onData` with everything received so far. */
function postChat(
  port: number,
  onData: (received: string, destroy: () => void) => void,
): Promise<{ status: number | undefined; body: string }> {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ question: 'Wann endet die Frist?' });
    const req = httpRequest(
      {
        host: '127.0.0.1',
        port,
        method: 'POST',
        path: `/notebooks/${NOTEBOOK}/chat`,
        headers: {
          'content-type': 'application/json',
          'content-length': Buffer.byteLength(body),
          [TEST_USER_HEADER]: USER,
        },
      },
      (res) => {
        let received = '';
        res.setEncoding('utf8');
        res.on('data', (chunk: string) => {
          received += chunk;
          onData(received, () => {
            req.destroy();
            resolve({ status: res.statusCode, body: received });
          });
        });
        res.on('end', () => resolve({ status: res.statusCode, body: received }));
      },
    );
    req.on('error', (error) => {
      // Destroying the request on purpose surfaces as a socket error; that is the test.
      if (!req.destroyed) reject(error);
    });
    req.end(body);
  });
}

describe('Chat abort', () => {
  let h: Harness;

  beforeEach(async () => {
    vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    h = await createHarness();
  });

  afterEach(async () => {
    await h.app.close();
    vi.restoreAllMocks();
  });

  it('hands the abort to the provider and saves no message when the client leaves', async () => {
    await postChat(h.port, (received, destroy) => {
      if (received.includes('event: token')) destroy();
    });
    await h.provider.aborted;

    expect(h.provider.requests[0]?.signal.aborted).toBe(true);
    expect(h.retrievals[0]?.signal).toBe(h.provider.requests[0]?.signal);
    expect(h.saved).toEqual([]);
    expect(h.usageEvents()).toBe(1);
  });

  it('does not abort a stream that completes, although the request body was read long before', async () => {
    h.provider.hang = false;

    const { status, body } = await postChat(h.port, () => undefined);

    expect(status).toBe(200);
    expect(body).toContain('event: done');
    expect(h.provider.requests[0]?.signal.aborted).toBe(false);
    expect(h.saved).toHaveLength(1);
  });
});
