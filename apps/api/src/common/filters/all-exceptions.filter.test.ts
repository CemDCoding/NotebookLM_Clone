import {
  Body,
  Controller,
  Get,
  type INestApplication,
  Logger,
  type MiddlewareConsumer,
  Module,
  type NestModule,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { ErrorCode } from '@notebooklm/shared';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { NotFoundError } from '../errors';
import { AllExceptionsFilter } from './all-exceptions.filter';
import { RequestIdMiddleware } from './request-id';

const SECRET_DETAIL = 'SELECT content FROM chunks WHERE user_id = 42';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

@Controller('test')
class ThrowingController {
  @Get('ok')
  ok(): { ok: true } {
    return { ok: true };
  }

  @Get('domain')
  domain(): never {
    throw new NotFoundError();
  }

  @Get('http')
  http(): never {
    throw new UnauthorizedException('jwt expired');
  }

  @Get('unknown')
  unknown(): never {
    throw new Error(SECRET_DETAIL);
  }

  @Post('echo')
  echo(@Body() body: unknown): unknown {
    return body;
  }
}

// Registers filter and middleware exactly like AppModule, without the database.
@Module({
  controllers: [ThrowingController],
  providers: [{ provide: APP_FILTER, useClass: AllExceptionsFilter }],
})
class TestModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware).forRoutes('{*path}');
  }
}

describe('AllExceptionsFilter', () => {
  let app: INestApplication;
  const logged = { error: vi.fn(), warn: vi.fn() };

  beforeAll(async () => {
    vi.spyOn(Logger.prototype, 'error').mockImplementation(logged.error);
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(logged.warn);

    const moduleRef = await Test.createTestingModule({ imports: [TestModule] }).compile();
    const nestApp = moduleRef.createNestApplication<NestExpressApplication>({ logger: false });
    nestApp.useBodyParser('json', { limit: '1kb' });
    app = await nestApp.init();
  });

  beforeEach(() => {
    logged.error.mockClear();
    logged.warn.mockClear();
  });

  afterAll(async () => {
    await app.close();
    vi.restoreAllMocks();
  });

  it('answers a domain error in the shared format', async () => {
    const res = await request(app.getHttpServer()).get('/test/domain').expect(404);

    expect(res.body).toEqual({
      statusCode: 404,
      error: 'NotFound',
      message: 'Die angeforderte Ressource wurde nicht gefunden.',
      code: ErrorCode.NOT_FOUND,
    });
  });

  it('answers a Nest HttpException in the shared format', async () => {
    const res = await request(app.getHttpServer()).get('/test/http').expect(401);

    expect(res.body).toEqual({
      statusCode: 401,
      error: 'Unauthorized',
      message: 'Bitte melde dich an.',
    });
  });

  it('answers an unknown error with 500 and no stack trace or internal detail', async () => {
    const res = await request(app.getHttpServer()).get('/test/unknown').expect(500);

    expect(res.body).toEqual({
      statusCode: 500,
      error: 'InternalServerError',
      message: 'Ein unerwarteter Fehler ist aufgetreten. Bitte versuche es später erneut.',
    });
    expect(res.text).not.toContain(SECRET_DETAIL);
    expect(res.text).not.toContain('.ts:');
  });

  it('answers 413 when the body parser rejects an oversized body', async () => {
    const res = await request(app.getHttpServer())
      .post('/test/echo')
      .send({ text: 'x'.repeat(2048) })
      .expect(413);

    expect(res.body).toMatchObject({
      statusCode: 413,
      error: 'PayloadTooLarge',
      code: ErrorCode.PAYLOAD_TOO_LARGE,
    });
    expect(res.headers['x-request-id']).toMatch(UUID);
  });

  it('answers malformed JSON with a German 400 instead of the parser message', async () => {
    const res = await request(app.getHttpServer())
      .post('/test/echo')
      .set('Content-Type', 'application/json')
      .send('{"text": ')
      .expect(400);

    expect(res.body).toEqual({
      statusCode: 400,
      error: 'BadRequest',
      message: 'Die Anfrage ist ungültig.',
    });
  });

  it('answers an unknown route with the same 404 as a missing resource', async () => {
    const res = await request(app.getHttpServer()).get('/does-not-exist').expect(404);

    expect(res.body).toMatchObject({ statusCode: 404, code: ErrorCode.NOT_FOUND });
  });

  it('logs only error class, status and request ID, never the message', async () => {
    const res = await request(app.getHttpServer()).get('/test/unknown').expect(500);

    expect(logged.error).toHaveBeenCalledTimes(1);
    expect(logged.error).toHaveBeenCalledWith({
      message: 'Request failed',
      requestId: res.headers['x-request-id'],
      statusCode: 500,
      errorClass: 'Error',
    });
    expect(JSON.stringify(logged.error.mock.calls)).not.toContain(SECRET_DETAIL);
  });

  it('logs client errors as warnings', async () => {
    await request(app.getHttpServer()).get('/test/domain').expect(404);

    expect(logged.error).not.toHaveBeenCalled();
    expect(logged.warn).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 404, errorClass: 'NotFoundError' }),
    );
  });

  describe('request ID', () => {
    it('takes over a valid X-Request-Id header and logs it', async () => {
      const res = await request(app.getHttpServer())
        .get('/test/domain')
        .set('X-Request-Id', 'railway-abc.123:4')
        .expect(404);

      expect(res.headers['x-request-id']).toBe('railway-abc.123:4');
      expect(logged.warn).toHaveBeenCalledWith(
        expect.objectContaining({ requestId: 'railway-abc.123:4' }),
      );
    });

    it('generates an ID when the header is missing', async () => {
      const res = await request(app.getHttpServer()).get('/test/ok').expect(200);

      expect(res.headers['x-request-id']).toMatch(UUID);
    });

    it.each(['has spaces', 'x'.repeat(129), 'quote"injection'])(
      'replaces an unsafe header value (%s)',
      async (unsafe) => {
        const res = await request(app.getHttpServer())
          .get('/test/ok')
          .set('X-Request-Id', unsafe)
          .expect(200);

        expect(res.headers['x-request-id']).toMatch(UUID);
      },
    );
  });
});
