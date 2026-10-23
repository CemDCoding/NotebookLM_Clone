import { type INestApplication, Logger } from '@nestjs/common';
import {
  ErrorCode,
  ErrorResponseSchema,
  type Notebook,
  NotebookListResponseSchema,
  NotebookSchema,
} from '@notebooklm/shared';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createNotebooksTestApp, TEST_USER_HEADER } from '../../test/support/notebooks-test-app';

const USER = '0b6c3f1e-1d2a-4c3b-9e4f-5a6b7c8d9e0f';

describe('Notebooks endpoints', () => {
  let app: INestApplication;

  async function start(maxNotebooksPerUser?: number): Promise<void> {
    ({ app } = await createNotebooksTestApp({ maxNotebooksPerUser }));
  }

  function api(): ReturnType<typeof request.agent> {
    return request.agent(app.getHttpServer()).set(TEST_USER_HEADER, USER);
  }

  async function createNotebook(title: string): Promise<Notebook> {
    const res = await api().post('/notebooks').send({ title }).expect(201);
    return NotebookSchema.parse(res.body);
  }

  beforeEach(() => {
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  afterEach(async () => {
    await app.close();
    vi.restoreAllMocks();
  });

  describe('responses match the shared contracts', () => {
    beforeEach(() => start());

    it('POST /notebooks answers 201 with a Notebook and a trimmed title', async () => {
      const res = await api().post('/notebooks').send({ title: '  Forschung  ' }).expect(201);

      const notebook = NotebookSchema.parse(res.body);
      expect(notebook).toMatchObject({ title: 'Forschung', sourceCount: 0 });
      expect(notebook.createdAt).toMatch(/Z$/);
    });

    it('GET /notebooks answers 200 with a NotebookListResponse, newest first', async () => {
      await createNotebook('Erstes');
      await createNotebook('Zweites');

      const res = await api().get('/notebooks').expect(200);

      const { notebooks } = NotebookListResponseSchema.parse(res.body);
      expect(notebooks.map((n) => n.title)).toEqual(['Zweites', 'Erstes']);
    });

    it('GET /notebooks answers an empty list for a new user', async () => {
      const res = await api().get('/notebooks').expect(200);

      expect(NotebookListResponseSchema.parse(res.body)).toEqual({ notebooks: [] });
    });

    it('GET /notebooks/:id answers 200 with the Notebook', async () => {
      const created = await createNotebook('Forschung');

      const res = await api().get(`/notebooks/${created.id}`).expect(200);

      expect(NotebookSchema.parse(res.body)).toEqual(created);
    });

    it('PATCH /notebooks/:id answers 200 with the renamed Notebook', async () => {
      const created = await createNotebook('Alt');

      const res = await api().patch(`/notebooks/${created.id}`).send({ title: 'Neu' }).expect(200);

      const renamed = NotebookSchema.parse(res.body);
      expect(renamed).toMatchObject({ id: created.id, title: 'Neu', createdAt: created.createdAt });
    });

    it('DELETE /notebooks/:id answers 204 without a body and removes the notebook', async () => {
      const created = await createNotebook('Weg damit');

      const res = await api().delete(`/notebooks/${created.id}`).expect(204);

      expect(res.text).toBe('');
      await api().get(`/notebooks/${created.id}`).expect(404);
    });
  });

  describe('validation', () => {
    beforeEach(() => start());

    it.each([
      ['an empty title', { title: '' }],
      ['a whitespace-only title', { title: '   ' }],
      ['a title over 200 characters', { title: 'x'.repeat(201) }],
      ['a missing title', {}],
    ])('rejects %s with 400 VALIDATION_FAILED', async (_case, body) => {
      const res = await api().post('/notebooks').send(body).expect(400);

      expect(ErrorResponseSchema.parse(res.body).code).toBe(ErrorCode.VALIDATION_FAILED);
    });

    it('rejects an invalid title on rename', async () => {
      const created = await createNotebook('Forschung');

      await api().patch(`/notebooks/${created.id}`).send({ title: '' }).expect(400);
    });

    it.each(['get', 'patch', 'delete'] as const)(
      'rejects a notebook ID that is not a UUID on %s with 400',
      async (method) => {
        const res = await api()[method]('/notebooks/not-a-uuid').send({ title: 'Neu' }).expect(400);

        expect(ErrorResponseSchema.parse(res.body).code).toBe(ErrorCode.VALIDATION_FAILED);
      },
    );
  });

  describe('notebook limit', () => {
    it('answers the notebook after the limit with 429 LIMIT_EXCEEDED and a German message', async () => {
      await start(25);
      for (let i = 1; i <= 25; i += 1) {
        await createNotebook(`Notebook ${i}`);
      }

      const res = await api().post('/notebooks').send({ title: 'Notebook 26' }).expect(429);

      const error = ErrorResponseSchema.parse(res.body);
      expect(error.code).toBe(ErrorCode.LIMIT_EXCEEDED);
      expect(error.message).toContain('höchstens 25 Notebooks');
      const list = await api().get('/notebooks').expect(200);
      expect(NotebookListResponseSchema.parse(list.body).notebooks).toHaveLength(25);
    });
  });

  describe('without a signed-in user', () => {
    beforeEach(() => start());

    it('answers 401 instead of reaching the repository', async () => {
      const res = await request(app.getHttpServer()).get('/notebooks').expect(401);

      expect(ErrorResponseSchema.safeParse(res.body).success).toBe(true);
    });
  });
});
