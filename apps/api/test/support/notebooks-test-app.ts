import { Global, type INestApplication, Module } from '@nestjs/common';
import { APP_FILTER, APP_PIPE } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { DEFAULT_LIMITS, type Limits } from '@notebooklm/shared';
import type { NextFunction, Request, Response } from 'express';
import { AllExceptionsFilter } from '../../src/common/filters';
import { ZodValidationPipe } from '../../src/common/pipes/zod-validation.pipe';
import type { AuthenticatedRequest } from '../../src/common/types';
import { AppConfigService } from '../../src/config';
import { LimitTransactions } from '../../src/limits/limit-transactions';
import { LimitsRepository } from '../../src/limits/limits.repository';
import { SourceCountsRepository } from '../../src/limits/source-counts.repository';
import { UsageEventsRepository } from '../../src/limits/usage-events.repository';
import { NotebooksModule } from '../../src/notebooks/notebooks.module';
import { NotebooksRepository } from '../../src/notebooks/notebooks.repository';
import { SourcesRepository } from '../../src/sources/sources.repository';
import { STORAGE_CLIENT, StorageService } from '../../src/storage/storage.service';
import { InMemoryNotebooks } from './in-memory-notebooks';
import { FakeStorage, InMemorySources, uploadLimitTables } from './in-memory-sources';

/**
 * Header carrying the user ID in tests. It stands in for the auth guard, which
 * sets `request.user` from a verified token in the real app; without it,
 * `@CurrentUser()` answers `401`.
 */
export const TEST_USER_HEADER = 'x-test-user';

export interface NotebooksTestApp {
  app: INestApplication;
  store: InMemoryNotebooks;
  sources: InMemorySources;
  storage: FakeStorage;
  /** Number of `upload` usage events written so far. */
  uploadEvents: () => number;
}

/**
 * The real `NotebooksModule`, and with it the `SourcesModule`, with the
 * global pipe and filter of `AppModule`, backed by in-memory stores instead
 * of the database and the storage bucket. Sources see the notebooks of the
 * notebook store, as they would through the database.
 */
export async function createNotebooksTestApp(
  limits: Partial<Limits> = {},
): Promise<NotebooksTestApp> {
  const store = new InMemoryNotebooks();
  const sources = new InMemorySources(
    [],
    async (userId, notebookId) => (await store.findById(userId, notebookId)) !== undefined,
  );
  const storage = new FakeStorage();
  const tables = uploadLimitTables(sources);
  // Unset overrides keep their default instead of becoming `undefined`.
  const overrides = Object.fromEntries(
    Object.entries(limits).filter(([, value]) => value !== undefined),
  );
  const config: Pick<AppConfigService, 'limits'> = {
    limits: { ...DEFAULT_LIMITS, ...overrides },
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
    .overrideProvider(LimitTransactions)
    .useValue(tables.transactions)
    .overrideProvider(SourceCountsRepository)
    .useValue(tables.sourceCounts)
    .overrideProvider(UsageEventsRepository)
    .useValue(tables.usageEvents)
    .overrideProvider(SourcesRepository)
    .useValue(sources)
    .overrideProvider(StorageService)
    .useValue(storage)
    // The real client would need the Supabase URL and key; the fake storage replaces its only user.
    .overrideProvider(STORAGE_CLIENT)
    .useValue({})
    .compile();

  const app = moduleRef.createNestApplication({ logger: false });
  app.use(fakeAuth);
  await app.init();
  return { app, store, sources, storage, uploadEvents: tables.uploadEvents };
}

function fakeAuth(req: Request, _res: Response, next: NextFunction): void {
  const userId = req.header(TEST_USER_HEADER);
  if (userId) {
    (req as Partial<AuthenticatedRequest>).user = { id: userId };
  }
  next();
}
