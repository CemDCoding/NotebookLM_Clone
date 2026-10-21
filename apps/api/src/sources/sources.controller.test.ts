import { type INestApplication, Logger } from '@nestjs/common';
import {
  ErrorCode,
  ErrorResponseSchema,
  type Limits,
  NotebookSchema,
  type Source,
  SourceListResponseSchema,
  SourceSchema,
} from '@notebooklm/shared';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { FakeStorage } from '../../test/support/in-memory-sources';
import { miniPdf } from '../../test/support/mini-pdf';
import { createNotebooksTestApp, TEST_USER_HEADER } from '../../test/support/notebooks-test-app';

const USER = '0b6c3f1e-1d2a-4c3b-9e4f-5a6b7c8d9e0f';
const INTRUDER = '7d8e9f0a-1b2c-4d3e-8f4a-5b6c7d8e9f0a';
const MISSING_ID = '00000000-0000-4000-8000-000000000000';

const text = Buffer.from('Grüße aus der Quelle.\n', 'utf8');
// Start of a PNG: invalid UTF-8 and NUL bytes.
const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);

describe('Sources endpoints', () => {
  let app: INestApplication;
  let storage: FakeStorage;
  let uploadEvents: () => number;
  let notebookId: string;

  async function start(limits: Partial<Limits> = {}): Promise<void> {
    vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    ({ app, storage, uploadEvents } = await createNotebooksTestApp(limits));
    const res = await as(USER).post('/notebooks').send({ title: 'Quellen' }).expect(201);
    notebookId = NotebookSchema.parse(res.body).id;
  }

  afterEach(async () => {
    await app.close();
    vi.restoreAllMocks();
  });

  function as(userId: string): ReturnType<typeof request.agent> {
    return request.agent(app.getHttpServer()).set(TEST_USER_HEADER, userId);
  }

  function upload(content: Buffer, filename: string, userId = USER, id = notebookId) {
    return as(userId).post(`/notebooks/${id}/sources/upload`).attach('file', content, filename);
  }

  async function uploaded(content: Buffer, filename: string): Promise<Source> {
    const res = await upload(content, filename).expect(201);
    return SourceSchema.parse(res.body);
  }

  function errorCode(body: unknown): string | undefined {
    return ErrorResponseSchema.parse(body).code;
  }

  describe('POST /notebooks/:id/sources/upload', () => {
    it('creates a pending source and stores the file under {userId}/{sourceId}', async () => {
      await start();

      const source = await uploaded(text, 'notizen.txt');

      expect(source).toMatchObject({ notebookId, type: 'text', title: 'notizen.txt' });
      expect(source.status).toBe('pending');
      expect(storage.files.get(`${USER}/${source.id}`)?.content.equals(text)).toBe(true);
      expect(uploadEvents()).toBe(1);
    });

    it('keeps umlauts in the file name as the title', async () => {
      await start();

      const source = await uploaded(text, 'Übersicht Größen.md');

      expect(source).toMatchObject({ type: 'markdown', title: 'Übersicht Größen.md' });
    });

    it('accepts a PDF and checks it by content', async () => {
      await start();

      await expect(uploaded(miniPdf(1), 'scan.txt')).resolves.toMatchObject({ type: 'pdf' });
    });

    it('rejects a file over the size limit with 413 while reading, without storing it', async () => {
      await start({ maxFileSizeBytes: 1024 });

      const res = await upload(Buffer.alloc(1025, 'a'), 'gross.txt').expect(413);

      expect(errorCode(res.body)).toBe(ErrorCode.PAYLOAD_TOO_LARGE);
      expect(storage.files.size).toBe(0);
      expect(uploadEvents()).toBe(0);
    });

    it('accepts a file of exactly the size limit', async () => {
      await start({ maxFileSizeBytes: 1024 });

      await upload(Buffer.alloc(1024, 'a'), 'genau.txt').expect(201);
    });

    it('rejects a binary file renamed to .txt with 415', async () => {
      await start();

      const res = await upload(png, 'bild.txt').expect(415);

      expect(errorCode(res.body)).toBe(ErrorCode.UNSUPPORTED_FILE);
      expect(uploadEvents()).toBe(0);
    });

    it('rejects a PDF over the page limit with 413', async () => {
      await start({ maxPdfPages: 1 });

      const res = await upload(miniPdf(2), 'lang.pdf').expect(413);

      expect(errorCode(res.body)).toBe(ErrorCode.PAYLOAD_TOO_LARGE);
    });

    it('answers 400 without a file', async () => {
      await start();

      const res = await as(USER)
        .post(`/notebooks/${notebookId}/sources/upload`)
        .send({ text: 'kein multipart' })
        .expect(400);

      expect(errorCode(res.body)).toBe(ErrorCode.VALIDATION_FAILED);
      expect(ErrorResponseSchema.parse(res.body).message).toContain('file');
    });

    it('answers 400 for extra fields, a file in another field or a second file', async () => {
      await start();

      await as(USER)
        .post(`/notebooks/${notebookId}/sources/upload`)
        .field('title', 'x')
        .attach('file', text, 'a.txt')
        .expect(400);
      await as(USER)
        .post(`/notebooks/${notebookId}/sources/upload`)
        .attach('upload', text, 'a.txt')
        .expect(400);
      await as(USER)
        .post(`/notebooks/${notebookId}/sources/upload`)
        .attach('file', text, 'a.txt')
        .attach('file', text, 'b.txt')
        .expect(400);
      expect(storage.files.size).toBe(0);
    });

    it('rejects the 21st source of a notebook with 429', async () => {
      await start();
      for (let i = 0; i < 20; i += 1) {
        await upload(text, `${i}.txt`).expect(201);
      }

      const res = await upload(text, '21.txt').expect(429);

      expect(errorCode(res.body)).toBe(ErrorCode.LIMIT_EXCEEDED);
      expect(storage.files.size).toBe(20);
    });
  });

  describe('POST /notebooks/:id/sources/text', () => {
    it('creates a pasted source stored as a UTF-8 file', async () => {
      await start();

      const res = await as(USER)
        .post(`/notebooks/${notebookId}/sources/text`)
        .send({ title: '  Notiz  ', text: 'Grüße' })
        .expect(201);
      const source = SourceSchema.parse(res.body);

      expect(source).toMatchObject({ type: 'pasted', title: 'Notiz', status: 'pending' });
      expect(storage.files.get(`${USER}/${source.id}`)?.content.toString('utf8')).toBe('Grüße');
    });

    it('answers 400 for a blank text', async () => {
      await start();

      const res = await as(USER)
        .post(`/notebooks/${notebookId}/sources/text`)
        .send({ title: 'Notiz', text: '   ' })
        .expect(400);

      expect(errorCode(res.body)).toBe(ErrorCode.VALIDATION_FAILED);
    });
  });

  describe('GET, PATCH and DELETE', () => {
    it('lists the sources of the notebook', async () => {
      await start();
      const source = await uploaded(text, 'a.txt');

      const res = await as(USER).get(`/notebooks/${notebookId}/sources`).expect(200);

      expect(SourceListResponseSchema.parse(res.body)).toEqual({ sources: [source] });
    });

    it('deactivates a source and keeps the state', async () => {
      await start();
      const source = await uploaded(text, 'a.txt');

      const res = await as(USER)
        .patch(`/notebooks/${notebookId}/sources/${source.id}`)
        .send({ isActive: false })
        .expect(200);

      expect(SourceSchema.parse(res.body).isActive).toBe(false);
      const list = await as(USER).get(`/notebooks/${notebookId}/sources`).expect(200);
      expect(SourceListResponseSchema.parse(list.body).sources[0]?.isActive).toBe(false);
    });

    it('answers 400 for a PATCH without a boolean isActive', async () => {
      await start();
      const source = await uploaded(text, 'a.txt');

      await as(USER)
        .patch(`/notebooks/${notebookId}/sources/${source.id}`)
        .send({ isActive: 'nein' })
        .expect(400);
    });

    it('deletes a source with its file', async () => {
      await start();
      const source = await uploaded(text, 'a.txt');

      await as(USER).delete(`/notebooks/${notebookId}/sources/${source.id}`).expect(204);

      expect(storage.files.size).toBe(0);
      const list = await as(USER).get(`/notebooks/${notebookId}/sources`).expect(200);
      expect(SourceListResponseSchema.parse(list.body).sources).toEqual([]);
    });

    it('does not return the daily quota when a source is deleted', async () => {
      await start();
      const source = await uploaded(text, 'a.txt');

      await as(USER).delete(`/notebooks/${notebookId}/sources/${source.id}`).expect(204);

      expect(uploadEvents()).toBe(1);
    });

    it('deletes the files of all sources when the notebook is deleted', async () => {
      await start();
      await uploaded(text, 'a.txt');
      await as(USER)
        .post(`/notebooks/${notebookId}/sources/text`)
        .send({ title: 'Notiz', text: 'b' })
        .expect(201);

      await as(USER).delete(`/notebooks/${notebookId}`).expect(204);

      expect(storage.files.size).toBe(0);
    });
  });

  // A source is only reachable through its own notebook: another user's
  // notebook or source answers exactly like a missing one.
  describe('ownership', () => {
    const requests = {
      'GET sources': (userId: string, id: string) => as(userId).get(`/notebooks/${id}/sources`),
      'POST upload': (userId: string, id: string) => upload(text, 'a.txt', userId, id),
      'POST text': (userId: string, id: string) =>
        as(userId).post(`/notebooks/${id}/sources/text`).send({ title: 'T', text: 'x' }),
    };

    describe.each(Object.entries(requests))('%s', (_route, send) => {
      it("answers 404 for another user's notebook, exactly like for a missing one", async () => {
        await start();

        const forbidden = await send(INTRUDER, notebookId).expect(404);
        const missing = await send(INTRUDER, MISSING_ID).expect(404);

        expect(errorCode(forbidden.body)).toBe(ErrorCode.NOT_FOUND);
        expect(forbidden.body).toEqual(missing.body);
        expect(uploadEvents()).toBe(0);
      });
    });

    const sourceRequests = {
      PATCH: (userId: string, id: string, sourceId: string) =>
        as(userId).patch(`/notebooks/${id}/sources/${sourceId}`).send({ isActive: false }),
      DELETE: (userId: string, id: string, sourceId: string) =>
        as(userId).delete(`/notebooks/${id}/sources/${sourceId}`),
    };

    describe.each(Object.entries(sourceRequests))('%s a source', (_route, send) => {
      it("answers 404 for another user's source and leaves it unchanged", async () => {
        await start();
        const source = await uploaded(text, 'a.txt');

        const forbidden = await send(INTRUDER, notebookId, source.id).expect(404);
        const missing = await send(USER, notebookId, MISSING_ID).expect(404);

        expect(forbidden.body).toEqual(missing.body);
        expect(storage.files.size).toBe(1);
        const list = await as(USER).get(`/notebooks/${notebookId}/sources`).expect(200);
        expect(SourceListResponseSchema.parse(list.body).sources).toEqual([source]);
      });

      it('answers 404 for an own source addressed through another notebook', async () => {
        await start();
        const source = await uploaded(text, 'a.txt');
        const other = await as(USER).post('/notebooks').send({ title: 'Anderes' }).expect(201);

        await send(USER, NotebookSchema.parse(other.body).id, source.id).expect(404);
        expect(storage.files.size).toBe(1);
      });
    });
  });
});
