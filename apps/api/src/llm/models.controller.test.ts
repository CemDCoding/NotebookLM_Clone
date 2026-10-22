import { Global, type INestApplication, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ModelListResponseSchema } from '@notebooklm/shared';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AppConfigService, validateEnv } from '../config';
import { ModelsModule } from './models.module';

const ENV = {
  WEB_ORIGIN: 'http://localhost:3000',
  DATABASE_URL: 'postgresql://user:pw@db.example.com:5432/postgres',
  SUPABASE_URL: 'https://project.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-secret',
  MISTRAL_API_KEY: 'mistral-secret',
};

// Global like `AppConfigModule` in the real app, so `LlmModule` can inject it.
@Global()
@Module({
  providers: [{ provide: AppConfigService, useValue: new AppConfigService(validateEnv(ENV)) }],
  exports: [AppConfigService],
})
class TestConfigModule {}

// The auth guard is tested centrally (test/auth-guard.test.ts); here only the route.
describe('GET /models', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [TestConfigModule, ModelsModule],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterEach(() => app.close());

  it('answers with the configured models in the shared format', async () => {
    const res = await request(app.getHttpServer()).get('/models').expect(200);

    const body = ModelListResponseSchema.parse(res.body);
    expect(body.models.map((model) => model.id)).toEqual([
      'mistral-small-latest',
      'ministral-8b-latest',
    ]);
  });
});
