import { type INestApplication, Logger } from '@nestjs/common';
import { APP_FILTER, APP_PIPE } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { type DataExport, ErrorResponseSchema, ExportSchema } from '@notebooklm/shared';
import type { NextFunction, Request, Response } from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AllExceptionsFilter } from '../common/filters';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import type { AuthenticatedRequest } from '../common/types';
import { AccountController } from './account.controller';
import { AccountService } from './account.service';

const USER = '0b6c3f1e-1d2a-4c3b-9e4f-5a6b7c8d9e0f';
const USER_HEADER = 'x-test-user';

const data: DataExport = {
  exportedAt: '2026-10-23T08:30:00.000Z',
  userId: USER,
  notebooks: [
    {
      id: '3a4b5c6d-7e8f-4a0b-9c1d-2e3f4a5b6c7d',
      title: 'Forschung',
      createdAt: '2026-10-20T10:00:00.000Z',
      updatedAt: '2026-10-20T10:05:00.000Z',
      sources: [],
      messages: [],
    },
  ],
};

/** Stands in for the auth guard, which sets `request.user` from a verified token. */
function fakeAuth(req: Request, _res: Response, next: NextFunction): void {
  const userId = req.header(USER_HEADER);
  if (userId) {
    (req as Partial<AuthenticatedRequest>).user = { id: userId };
  }
  next();
}

describe('AccountController', () => {
  let app: INestApplication;
  const account = { export: vi.fn<AccountService['export']>() };

  beforeEach(async () => {
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    account.export.mockResolvedValue(data);
    const moduleRef = await Test.createTestingModule({
      controllers: [AccountController],
      providers: [
        { provide: AccountService, useValue: account },
        { provide: APP_PIPE, useClass: ZodValidationPipe },
        { provide: APP_FILTER, useClass: AllExceptionsFilter },
      ],
    }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    app.use(fakeAuth);
    await app.init();
  });

  afterEach(async () => {
    await app.close();
    vi.restoreAllMocks();
    account.export.mockReset();
  });

  it('GET /me/export answers the export of the signed-in user as a JSON download', async () => {
    const res = await request(app.getHttpServer())
      .get('/me/export')
      .set(USER_HEADER, USER)
      .expect(200);

    expect(account.export).toHaveBeenCalledWith(USER);
    expect(ExportSchema.parse(res.body)).toEqual(data);
    expect(res.headers['content-type']).toMatch(/^application\/json/);
    expect(res.headers['content-disposition']).toBe(
      'attachment; filename="quellenchat-export-2026-10-23.json"',
    );
    expect(res.headers['cache-control']).toBe('no-store');
  });

  it('answers 401 without a user', async () => {
    const res = await request(app.getHttpServer()).get('/me/export').expect(401);

    expect(ErrorResponseSchema.parse(res.body).statusCode).toBe(401);
    expect(account.export).not.toHaveBeenCalled();
  });

  it('answers a failed export as a JSON error, not as a download', async () => {
    account.export.mockRejectedValue(new Error('schema mismatch'));

    const res = await request(app.getHttpServer())
      .get('/me/export')
      .set(USER_HEADER, USER)
      .expect(500);

    expect(ErrorResponseSchema.parse(res.body).statusCode).toBe(500);
    expect(res.headers['content-disposition']).toBeUndefined();
    expect(JSON.stringify(res.body)).not.toContain('schema mismatch');
  });
});
