import { type INestApplication, Logger } from '@nestjs/common';
import { APP_FILTER, APP_PIPE } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import {
  type ChatEvent,
  ChatEventSchema,
  ErrorCode,
  ErrorResponseSchema,
  type Message,
  MessageListResponseSchema,
} from '@notebooklm/shared';
import type { NextFunction, Request, Response } from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LimitExceededError, NotFoundError } from '../common/errors';
import { AllExceptionsFilter } from '../common/filters';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import type { AuthenticatedRequest } from '../common/types';
import { UnknownModelError } from '../llm/model-registry';
import { ChatController } from './chat.controller';
import { NoReadySourcesError } from './chat.errors';
import { type AcceptedChat, ChatService } from './chat.service';

const USER = '0b6c3f1e-1d2a-4c3b-9e4f-5a6b7c8d9e0f';
const NOTEBOOK = '3a4b5c6d-7e8f-4a0b-9c1d-2e3f4a5b6c7d';

const accepted: AcceptedChat = {
  userId: USER,
  notebookId: NOTEBOOK,
  question: 'Wann?',
  model: { id: 'mistral-small-latest', provider: 'mistral', name: 'mistral-small-latest' },
  acceptedAt: new Date('2026-10-23T10:00:00.000Z'),
};

const events: ChatEvent[] = [
  { type: 'token', text: 'Die Frist ' },
  { type: 'token', text: 'endet [1].' },
  { type: 'citations', citations: [] },
  {
    type: 'done',
    messageId: '3f6c1f0e-8b2a-4c1d-9e57-2a4b6d8f0a11',
    model: 'mistral-small-latest',
  },
];

/** The two lines of every frame in an SSE body. */
function framesOf(body: string): { name: string; event: ChatEvent }[] {
  return body
    .split('\n\n')
    .filter((frame) => frame !== '')
    .map((frame) => {
      const [eventLine = '', dataLine = ''] = frame.split('\n');
      return {
        name: eventLine.replace(/^event: /, ''),
        event: ChatEventSchema.parse(JSON.parse(dataLine.replace(/^data: /, ''))),
      };
    });
}

describe('ChatController', () => {
  let app: INestApplication;
  const chat = {
    accept: vi.fn<ChatService['accept']>(),
    answer: vi.fn<ChatService['answer']>(),
    listMessages: vi.fn<ChatService['listMessages']>(),
    clearMessages: vi.fn<ChatService['clearMessages']>(),
  };

  beforeEach(async () => {
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    chat.accept.mockResolvedValue(accepted);
    chat.answer.mockImplementation(async function* () {
      yield* events;
    });
    const moduleRef = await Test.createTestingModule({
      controllers: [ChatController],
      providers: [
        { provide: ChatService, useValue: chat },
        { provide: APP_PIPE, useClass: ZodValidationPipe },
        { provide: APP_FILTER, useClass: AllExceptionsFilter },
      ],
    }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    app.use((req: Request, _res: Response, next: NextFunction) => {
      (req as Partial<AuthenticatedRequest>).user = { id: USER };
      next();
    });
    await app.init();
  });

  afterEach(async () => {
    await app.close();
    vi.resetAllMocks();
    vi.restoreAllMocks();
  });

  const post = (body: object = { question: 'Wann?' }) =>
    request(app.getHttpServer()).post(`/notebooks/${NOTEBOOK}/chat`).send(body);

  describe('POST /notebooks/:id/chat', () => {
    it('streams the events as SSE frames named after their type', async () => {
      const res = await post().expect(200);

      expect(res.headers['content-type']).toMatch(/^text\/event-stream/);
      expect(res.headers['cache-control']).toBe('no-cache');
      expect(res.headers['x-accel-buffering']).toBe('no');
      const frames = framesOf(res.text);
      expect(frames.map((frame) => frame.event)).toEqual(events);
      for (const frame of frames) {
        expect(frame.name).toBe(frame.event.type);
      }
    });

    it('passes the validated body and the signed-in user to the service', async () => {
      await post({ question: '  Wann?  ', model: 'ollama:llama3.2' }).expect(200);

      expect(chat.accept).toHaveBeenCalledWith(USER, NOTEBOOK, {
        question: 'Wann?',
        model: 'ollama:llama3.2',
      });
      expect(chat.answer).toHaveBeenCalledWith(accepted, expect.any(AbortSignal));
    });

    it('rejects an invalid question with 400 before the service is called', async () => {
      const res = await post({ question: '' }).expect(400);

      expect(ErrorResponseSchema.parse(res.body).code).toBe(ErrorCode.VALIDATION_FAILED);
      expect(chat.accept).not.toHaveBeenCalled();
    });

    it.each([
      ['a foreign notebook', new NotFoundError(), 404, ErrorCode.NOT_FOUND],
      ['an unknown model', new UnknownModelError(), 400, ErrorCode.VALIDATION_FAILED],
      ['no ready sources', new NoReadySourcesError(), 409, ErrorCode.NO_READY_SOURCES],
      ['a reached limit', new LimitExceededError('Limit erreicht.'), 429, ErrorCode.LIMIT_EXCEEDED],
    ])('answers %s as a JSON error before the stream opens', async (_case, error, status, code) => {
      chat.accept.mockRejectedValue(error);

      const res = await post().expect(status);

      expect(res.headers['content-type']).toMatch(/^application\/json/);
      expect(ErrorResponseSchema.parse(res.body)).toMatchObject({ code, message: error.message });
      expect(chat.answer).not.toHaveBeenCalled();
    });

    it('sends an error event from the service as a frame', async () => {
      chat.answer.mockImplementation(async function* () {
        yield { type: 'error', code: 'MODEL_UNAVAILABLE', message: 'Nicht erreichbar.' };
      });

      const res = await post().expect(200);

      expect(framesOf(res.text)).toEqual([
        {
          name: 'error',
          event: { type: 'error', code: 'MODEL_UNAVAILABLE', message: 'Nicht erreichbar.' },
        },
      ]);
    });
  });

  describe('GET /notebooks/:id/messages', () => {
    it('returns the history of the service', async () => {
      const message: Message = {
        id: '3f6c1f0e-8b2a-4c1d-9e57-2a4b6d8f0a11',
        role: 'user',
        content: 'Wann?',
        model: null,
        citations: [],
        createdAt: '2026-10-23T10:00:00.000Z',
      };
      chat.listMessages.mockResolvedValue([message]);

      const res = await request(app.getHttpServer())
        .get(`/notebooks/${NOTEBOOK}/messages`)
        .expect(200);

      expect(MessageListResponseSchema.parse(res.body)).toEqual({ messages: [message] });
      expect(chat.listMessages).toHaveBeenCalledWith(USER, NOTEBOOK);
    });

    it('rejects an invalid notebook id with 400', async () => {
      await request(app.getHttpServer()).get('/notebooks/abc/messages').expect(400);
      expect(chat.listMessages).not.toHaveBeenCalled();
    });
  });

  describe('DELETE /notebooks/:id/messages', () => {
    it('answers 204 without a body', async () => {
      chat.clearMessages.mockResolvedValue(undefined);

      const res = await request(app.getHttpServer())
        .delete(`/notebooks/${NOTEBOOK}/messages`)
        .expect(204);

      expect(res.text).toBe('');
      expect(chat.clearMessages).toHaveBeenCalledWith(USER, NOTEBOOK);
    });

    it('answers 404 for a foreign notebook', async () => {
      chat.clearMessages.mockRejectedValue(new NotFoundError());

      await request(app.getHttpServer()).delete(`/notebooks/${NOTEBOOK}/messages`).expect(404);
    });
  });
});
