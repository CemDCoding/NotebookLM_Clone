import { Controller, Get, type INestApplication, Logger } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ErrorResponseSchema } from '@notebooklm/shared';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppModule, IP_THROTTLE } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters';
import { validateEnv } from '../src/config';

// The technical rate limit per IP (CLAUDE.md section 7, PE-28): proven once
// with the app's own options, on top of the business limits in the database.

@Controller('ping')
class PingController {
  @Get()
  ping(): { ok: true } {
    return { ok: true };
  }
}

describe('Throttler', () => {
  let app: INestApplication;

  beforeEach(async () => {
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const moduleRef = await Test.createTestingModule({
      imports: [ThrottlerModule.forRoot({ throttlers: [IP_THROTTLE] })],
      controllers: [PingController],
      providers: [
        { provide: APP_GUARD, useClass: ThrottlerGuard },
        { provide: APP_FILTER, useClass: AllExceptionsFilter },
      ],
    }).compile();
    app = await moduleRef.createNestApplication({ logger: false }).init();
  });

  afterEach(async () => {
    await app.close();
    vi.restoreAllMocks();
  });

  it('allows 120 requests per minute and IP', () => {
    expect(IP_THROTTLE).toEqual({ ttl: 60_000, limit: 120 });
  });

  it('answers the request after the limit with 429 in the shared format', async () => {
    for (let i = 0; i < IP_THROTTLE.limit; i++) {
      await request(app.getHttpServer()).get('/ping').expect(200);
    }

    const res = await request(app.getHttpServer()).get('/ping').expect(429);

    expect(ErrorResponseSchema.parse(res.body)).toEqual({
      statusCode: 429,
      error: 'TooManyRequests',
      message: 'Zu viele Anfragen. Bitte warte einen Moment und versuche es erneut.',
    });
    expect(res.headers['retry-after']).toBeDefined();
  });

  it('is registered as a global guard of the app', () => {
    const env = validateEnv({
      WEB_ORIGIN: 'https://quellenchat.example.com',
      DATABASE_URL: 'postgresql://user:password@localhost:5432/postgres',
      SUPABASE_URL: 'https://project-ref.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
      MISTRAL_API_KEY: 'mistral-key',
    });

    expect(AppModule.forRoot(env).providers).toContainEqual({
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    });
  });
});
