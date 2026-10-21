import { Global, type INestApplication, Module } from '@nestjs/common';
import { APP_FILTER, APP_PIPE } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { DEFAULT_LIMITS } from '@notebooklm/shared';
import type { NextFunction, Request, Response } from 'express';
import { AllExceptionsFilter } from '../../src/common/filters';
import { ZodValidationPipe } from '../../src/common/pipes/zod-validation.pipe';
import type { AuthenticatedRequest } from '../../src/common/types';
import { AppConfigService } from '../../src/config';
import { LimitTransactions } from '../../src/limits/limit-transactions';
import { LimitsRepository } from '../../src/limits/limits.repository';
import { NotebooksModule } from '../../src/notebooks/notebooks.module';
import { NotebooksRepository } from '../../src/notebooks/notebooks.repository';
import { InMemoryNotebooks } from './in-memory-notebooks';

/**
 * Header carrying the user ID in tests. It stands in for the auth guard, which
 * sets `request.user` from a verified token in the real app; without it,
 * `@CurrentUser()` answers `401`.
 */
export const TEST_USER_HEADER = 'x-test-user';

export interface NotebooksTestApp {
  app: INestApplication;
  store: InMemoryNotebooks;
}

/**
 * The real `NotebooksModule` with the global pipe and filter of `AppModule`,
 * backed by an in-memory store instead of the database.
 */
export async function createNotebooksTestApp(
  maxNotebooksPerUser: number = DEFAULT_LIMITS.maxNotebooksPerUser,
): Promise<NotebooksTestApp> {
  const store = new InMemoryNotebooks();
  const config: Pick<AppConfigService, 'limits'> = {
    limits: { ...DEFAULT_LIMITS, maxNotebooksPerUser },
  };

  // Global like `AppConfigModule` in the real app, so `LimitsModule` can inject it.
  @Global()
  @Module({
    providers: [{ provide: AppConfigService, useValue: config }],
    exports: [AppConfigService],
  })
  class TestConfigModule {}

  const moduleRef = await Test.createTestingModule({
    imports: [TestConfigModule, NotebooksModule],
    providers: [
      { provide: APP_PIPE, useClass: ZodValidationPipe },
      { provide: APP_FILTER, useClass: AllExceptionsFilter },
    ],
  })
    .overrideProvider(NotebooksRepository)
    .useValue(store)
    .overrideProvider(LimitsRepository)
    .useValue(store)
    // Needs the database, which this app has none of. Notebook routes never use it.
    .overrideProvider(LimitTransactions)
    .useValue({})
    .compile();

  const app = moduleRef.createNestApplication({ logger: false });
  app.use(fakeAuth);
  await app.init();
  return { app, store };
}

function fakeAuth(req: Request, _res: Response, next: NextFunction): void {
  const userId = req.header(TEST_USER_HEADER);
  if (userId) {
    (req as Partial<AuthenticatedRequest>).user = { id: userId };
  }
  next();
}
