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
import { createNotebooksTestApp, TEST_USER_HEADER } from './support/notebooks-test-app';

// Central ownership test (CLAUDE.md section 11): a resource of another user
// answers exactly like a missing one, `404`, so its existence stays hidden.
// Later nested resources (sources, messages) reuse the same repository rule
// and add their cases here.

const OWNER = '0b6c3f1e-1d2a-4c3b-9e4f-5a6b7c8d9e0f';
const INTRUDER = '7d8e9f0a-1b2c-4d3e-8f4a-5b6c7d8e9f0a';
const MISSING_ID = '00000000-0000-4000-8000-000000000000';

describe('Ownership: notebooks of other users', () => {
  let app: INestApplication;
  let foreign: Notebook;

  function as(userId: string): ReturnType<typeof request.agent> {
    return request.agent(app.getHttpServer()).set(TEST_USER_HEADER, userId);
  }

  beforeEach(async () => {
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    ({ app } = await createNotebooksTestApp());
    const res = await as(OWNER).post('/notebooks').send({ title: 'Privat' }).expect(201);
    foreign = NotebookSchema.parse(res.body);
  });

  afterEach(async () => {
    await app.close();
    vi.restoreAllMocks();
  });

  const requests = {
    'GET /notebooks/:id': (userId: string, id: string) => as(userId).get(`/notebooks/${id}`),
    'PATCH /notebooks/:id': (userId: string, id: string) =>
      as(userId).patch(`/notebooks/${id}`).send({ title: 'Übernommen' }),
    'DELETE /notebooks/:id': (userId: string, id: string) => as(userId).delete(`/notebooks/${id}`),
  };

  describe.each(Object.entries(requests))('%s', (_route, send) => {
    it('answers 404 for a notebook of another user', async () => {
      const res = await send(INTRUDER, foreign.id).expect(404);

      expect(ErrorResponseSchema.parse(res.body).code).toBe(ErrorCode.NOT_FOUND);
    });

    it('answers exactly like for a notebook that does not exist', async () => {
      const forbidden = await send(INTRUDER, foreign.id);
      const missing = await send(INTRUDER, MISSING_ID);

      expect(forbidden.status).toBe(missing.status);
      expect(forbidden.body).toEqual(missing.body);
    });

    it('leaves the notebook of the other user unchanged', async () => {
      await send(INTRUDER, foreign.id);

      const res = await as(OWNER).get(`/notebooks/${foreign.id}`).expect(200);
      expect(NotebookSchema.parse(res.body)).toEqual(foreign);
    });
  });

  it('GET /notebooks lists no notebooks of other users', async () => {
    const res = await as(INTRUDER).get('/notebooks').expect(200);

    expect(NotebookListResponseSchema.parse(res.body)).toEqual({ notebooks: [] });
  });

  it('POST /notebooks assigns the new notebook to the signed-in user, not to one in the body', async () => {
    const res = await as(INTRUDER)
      .post('/notebooks')
      .send({ title: 'Eigenes', userId: OWNER })
      .expect(201);
    const created = NotebookSchema.parse(res.body);

    await as(INTRUDER).get(`/notebooks/${created.id}`).expect(200);
    await as(OWNER).get(`/notebooks/${created.id}`).expect(404);
  });
});
