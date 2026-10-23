import {
  BadRequestException,
  Body,
  Controller,
  type INestApplication,
  Post,
  Query,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ErrorCode, ErrorResponseSchema } from '@notebooklm/shared';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { AppModule } from '../../app.module';
import { validateEnv } from '../../config';
import { PG_BOSS } from '../../queue/queue.service';
import { Public } from '../decorators';
import { ZodValidationPipe } from './zod-validation.pipe';

const ItemSchema = z.object({
  title: z.string().min(1),
  tags: z.array(z.string()).max(2).default([]),
});

const PageQuerySchema = z.object({ page: z.coerce.number().int().min(1) });

type Item = z.infer<typeof ItemSchema>;
type PageQuery = z.infer<typeof PageQuerySchema>;

function bodyOf(error: unknown): unknown {
  expect(error).toBeInstanceOf(BadRequestException);
  return (error as BadRequestException).getResponse();
}

describe('ZodValidationPipe', () => {
  const pipe = new ZodValidationPipe();

  it('returns the parsed value, including defaults', async () => {
    await expect(
      pipe.transform({ title: 'Notizen' }, { type: 'body', schema: ItemSchema }),
    ).resolves.toEqual({
      title: 'Notizen',
      tags: [],
    });
  });

  it('coerces query values with the schema', async () => {
    await expect(
      pipe.transform({ page: '2' }, { type: 'query', schema: PageQuerySchema }),
    ).resolves.toEqual({
      page: 2,
    });
  });

  it('rejects invalid input with 400 in the shared error format and names the fields', async () => {
    const error: unknown = await pipe
      .transform({ title: '', tags: ['a', 'b', 'c'] }, { type: 'body', schema: ItemSchema })
      .catch((caught: unknown) => caught);

    const body = ErrorResponseSchema.parse(bodyOf(error));
    expect(body.statusCode).toBe(400);
    expect(body.code).toBe(ErrorCode.VALIDATION_FAILED);
    expect(body.message).toContain('title');
    expect(body.message).toContain('tags');
  });

  it('rejects a body that is not an object without listing fields', async () => {
    const error: unknown = await pipe
      .transform('kein Objekt', { type: 'body', schema: ItemSchema })
      .catch((caught: unknown) => caught);

    expect(ErrorResponseSchema.parse(bodyOf(error)).message).toBe('Die Anfrage ist ungültig.');
  });

  it('passes arguments without a schema through unchanged', async () => {
    const value = { anything: true };

    await expect(pipe.transform(value, { type: 'body' })).resolves.toBe(value);
  });

  it('skips custom parameter decorators such as @CurrentUser()', async () => {
    const value = 'user-id';

    await expect(pipe.transform(value, { type: 'custom', schema: ItemSchema })).resolves.toBe(
      value,
    );
  });
});

// Public, so this test exercises the pipe and not the global auth guard of AppModule.
@Public()
@Controller('items')
class ItemsController {
  @Post()
  create(
    @Body({ schema: ItemSchema }) item: Item,
    @Query({ schema: PageQuerySchema }) query: PageQuery,
  ) {
    return { item, query };
  }
}

// Stands in for pg-boss: accepts every call and never touches a database.
const idleBoss = {
  on: () => undefined,
  start: () => Promise.resolve(),
  stop: () => Promise.resolve(),
  createQueue: () => Promise.resolve(),
  send: () => Promise.resolve(null),
  work: () => Promise.resolve('worker'),
  schedule: () => Promise.resolve(),
};

describe('ZodValidationPipe as global pipe', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const env = validateEnv({
      WEB_ORIGIN: 'http://localhost:3000',
      DATABASE_URL: 'postgresql://user:pw@localhost:5432/postgres',
      SUPABASE_URL: 'https://project.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'test',
      MISTRAL_API_KEY: 'test',
    });
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule.forRoot(env)],
      controllers: [ItemsController],
    })
      // pg-boss connects on start; this test has no database.
      .overrideProvider(PG_BOSS)
      .useValue(idleBoss)
      .compile();
    app = moduleRef.createNestApplication({ logger: false });
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('hands validated and transformed values to the handler', async () => {
    const response = await request(app.getHttpServer())
      .post('/items?page=3')
      .send({ title: 'Notizen' })
      .expect(201);

    expect(response.body).toEqual({ item: { title: 'Notizen', tags: [] }, query: { page: 3 } });
  });

  it('answers invalid requests with 400 in the shared error format', async () => {
    const response = await request(app.getHttpServer()).post('/items?page=0').send({}).expect(400);

    const body = ErrorResponseSchema.parse(response.body);
    expect(body.code).toBe(ErrorCode.VALIDATION_FAILED);
  });
});
