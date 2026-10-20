import { type INestApplication, Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { HealthResponseSchema } from '@notebooklm/shared';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DRIZZLE } from '../db/db.module';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';

async function createApp(execute: () => Promise<unknown>): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({
    controllers: [HealthController],
    providers: [HealthService, { provide: DRIZZLE, useValue: { execute } }],
  }).compile();
  return moduleRef.createNestApplication({ logger: false }).init();
}

describe('GET /health', () => {
  let app: INestApplication | undefined;

  afterEach(async () => {
    await app?.close();
    vi.restoreAllMocks();
  });

  it('answers 200 when the database responds', async () => {
    const execute = vi.fn().mockResolvedValue([{ '?column?': 1 }]);
    app = await createApp(execute);

    const res = await request(app.getHttpServer()).get('/health').expect(200);

    expect(res.body).toEqual({ status: 'ok', database: 'up' });
    expect(HealthResponseSchema.safeParse(res.body).success).toBe(true);
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it('answers 503 when the database is unreachable, without connection details', async () => {
    const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const failure = new Error('getaddrinfo ENOTFOUND db.secret-host.supabase.co');
    app = await createApp(vi.fn().mockRejectedValue(failure));

    const res = await request(app.getHttpServer()).get('/health').expect(503);

    expect(res.body).toEqual({ status: 'error', database: 'down' });
    expect(res.text).not.toContain('secret-host');
    expect(JSON.stringify(warn.mock.calls)).not.toContain('secret-host');
  });
});
