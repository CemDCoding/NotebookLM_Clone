import { Body, Controller, type INestApplication, Logger, Post } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { DEFAULT_LIMITS, ErrorCode } from '@notebooklm/shared';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { AllExceptionsFilter } from './common/filters';
import { configureHttpApp } from './http-app';

const WEB_ORIGIN = 'https://quellenchat.example.com';

@Controller('test')
class EchoController {
  // Answers only the length, so a 1.5 MB body does not come back.
  @Post('echo')
  echo(@Body() body: { text: string }): { length: number } {
    return { length: body.text.length };
  }
}

// The exact setup of `main.ts`, applied to an app without a database
// (CLAUDE.md section 7 "Härtung", apps/api/CLAUDE.md "Body-Limits").
describe('configureHttpApp', () => {
  let app: INestApplication;

  beforeAll(async () => {
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const moduleRef = await Test.createTestingModule({
      controllers: [EchoController],
      providers: [{ provide: APP_FILTER, useClass: AllExceptionsFilter }],
    }).compile();
    const nestApp = moduleRef.createNestApplication<NestExpressApplication>({ logger: false });
    configureHttpApp(nestApp, { webOrigin: WEB_ORIGIN });
    app = await nestApp.init();
  });

  afterAll(async () => {
    await app.close();
    vi.restoreAllMocks();
  });

  function api() {
    return request(app.getHttpServer());
  }

  describe('security headers', () => {
    it('sets the Helmet headers and hides the framework', async () => {
      const res = await api().post('/test/echo').send({ text: 'a' }).expect(201);

      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['strict-transport-security']).toContain('max-age=');
      expect(res.headers['content-security-policy']).toContain("default-src 'self'");
      expect(res.headers['x-powered-by']).toBeUndefined();
    });
  });

  describe('CORS', () => {
    it('allows the web origin and exposes the request ID', async () => {
      const res = await api()
        .post('/test/echo')
        .set('Origin', WEB_ORIGIN)
        .send({ text: 'a' })
        .expect(201);

      expect(res.headers['access-control-allow-origin']).toBe(WEB_ORIGIN);
      expect(res.headers['access-control-expose-headers']).toBe('X-Request-Id');
    });

    it('answers the preflight of the web origin with the allowed methods and headers', async () => {
      const res = await api()
        .options('/test/echo')
        .set('Origin', WEB_ORIGIN)
        .set('Access-Control-Request-Method', 'PATCH')
        .set('Access-Control-Request-Headers', 'authorization,content-type')
        .expect(204);

      expect(res.headers['access-control-allow-origin']).toBe(WEB_ORIGIN);
      expect(res.headers['access-control-allow-methods']).toBe('GET,POST,PATCH,DELETE');
      expect(res.headers['access-control-allow-headers']).toBe('Authorization,Content-Type');
    });

    // With a fixed origin, `cors` always answers with that origin. A browser on
    // another origin sees the mismatch and blocks the response.
    it('never allows another origin', async () => {
      const res = await api()
        .options('/test/echo')
        .set('Origin', 'https://evil.example.com')
        .set('Access-Control-Request-Method', 'POST');

      expect(res.headers['access-control-allow-origin']).toBe(WEB_ORIGIN);
    });
  });

  describe('JSON body limit', () => {
    // '€' is one UTF-16 unit, which Zod counts, but three bytes in UTF-8.
    it('accepts pasted text at the character limit with multi-byte characters', async () => {
      const text = '€'.repeat(DEFAULT_LIMITS.maxPastedTextChars);

      const res = await api().post('/test/echo').send({ text }).expect(201);

      expect(res.body).toEqual({ length: DEFAULT_LIMITS.maxPastedTextChars });
    });

    it('rejects a body over 2 MB with 413 and a German message', async () => {
      const res = await api()
        .post('/test/echo')
        .send({ text: 'x'.repeat(2 * 1024 * 1024) })
        .expect(413);

      expect(res.body).toEqual({
        statusCode: 413,
        error: 'PayloadTooLarge',
        message: 'Die Anfrage ist zu groß. Bitte kürze den Text oder wähle eine kleinere Datei.',
        code: ErrorCode.PAYLOAD_TOO_LARGE,
      });
    });
  });

  it('trusts exactly one proxy hop, so the throttler sees the client IP', () => {
    const express = (app as NestExpressApplication).getHttpAdapter().getInstance() as {
      get(setting: string): unknown;
    };

    expect(express.get('trust proxy')).toBe(1);
  });
});
