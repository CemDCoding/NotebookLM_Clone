import 'reflect-metadata';
import { SELF_DECLARED_DEPS_METADATA } from '@nestjs/common/constants';
import { Test } from '@nestjs/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { validateEnv } from '../../config/env.schema';
import { PG_BOSS, QueueService } from '../../queue/queue.service';
import { StorageService } from '../../storage/storage.service';
import { DRIZZLE } from '../db.module';
import { DrizzleDemoNotebooks } from './drizzle-demo-notebooks';
import { DrizzleDemoSources } from './drizzle-demo-sources';
import { SeedModule } from './seed.module';
import { SupabaseUserAdmin } from './supabase-user-admin';

const ENV = validateEnv({
  RUN_MODE: 'api',
  WEB_ORIGIN: 'http://localhost:3000',
  DATABASE_URL: 'postgresql://user:pw@db.example.com:5432/postgres',
  SUPABASE_URL: 'https://project.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-secret',
  MISTRAL_API_KEY: 'mistral-secret',
});

const fakeBoss = { stop: () => Promise.resolve() };

let close: (() => Promise<void>) | undefined;

afterEach(async () => {
  await close?.();
  close = undefined;
});

describe('SeedModule', () => {
  // Vitest compiles with SWC, which emits decorator metadata and would hide a
  // missing @Inject. The seed runs under tsx, which emits none, so only
  // explicitly declared dependencies can be resolved there.
  it.each([DrizzleDemoNotebooks, DrizzleDemoSources])(
    '%o declares its database dependency explicitly',
    (provider) => {
      const declared = Reflect.getMetadata(SELF_DECLARED_DEPS_METADATA, provider) as
        { index: number; param: unknown }[] | undefined;

      expect(declared).toEqual([{ index: 0, param: DRIZZLE }]);
    },
  );

  it('resolves everything the seed uses, without connecting', async () => {
    const moduleRef = await Test.createTestingModule({ imports: [SeedModule.forRoot(ENV)] })
      .overrideProvider(PG_BOSS)
      .useValue(fakeBoss)
      .compile();
    close = () => moduleRef.close();

    for (const token of [
      SupabaseUserAdmin,
      DrizzleDemoNotebooks,
      DrizzleDemoSources,
      StorageService,
      QueueService,
    ]) {
      expect(moduleRef.get(token)).toBeInstanceOf(token);
    }
  });
});
