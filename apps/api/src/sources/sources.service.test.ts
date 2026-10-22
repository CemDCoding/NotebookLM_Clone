import { Logger } from '@nestjs/common';
import { DEFAULT_LIMITS, ErrorCode, type Limits, SourceSchema } from '@notebooklm/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FakeQueue } from '../../test/support/fake-queue';
import {
  type CallLog,
  createUploadLimits,
  FakeStorage,
  InMemorySources,
} from '../../test/support/in-memory-sources';
import { miniPdf } from '../../test/support/mini-pdf';
import {
  LimitExceededError,
  NotFoundError,
  PayloadTooLargeError,
  UnsupportedFileError,
} from '../common/errors';
import type { AppConfigService } from '../config';
import type { QueueService } from '../queue/queue.service';
import type { StorageService } from '../storage/storage.service';
import type { SourcesRepository } from './sources.repository';
import { SourcesService } from './sources.service';

const USER = '0b6c3f1e-1d2a-4c3b-9e4f-5a6b7c8d9e0f';
const OTHER_USER = '7d8e9f0a-1b2c-4d3e-8f4a-5b6c7d8e9f0a';
const NOTEBOOK = '3a4b5c6d-7e8f-4a0b-9c1d-2e3f4a5b6c7d';
const OTHER_NOTEBOOK = '9f8e7d6c-5b4a-4c2d-8e1f-0a9b8c7d6e5f';
const MISSING_ID = '00000000-0000-4000-8000-000000000000';

const markdown = Buffer.from('# Überschrift\n\nÄpfel und Birnen.\n', 'utf8');
// Start of a PNG: invalid UTF-8 and NUL bytes.
const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);

interface Fixture {
  service: SourcesService;
  sources: InMemorySources;
  storage: FakeStorage;
  queue: FakeQueue;
  calls: CallLog;
  uploadEvents: () => number;
}

function createService(overrides: Partial<Limits> = {}): Fixture {
  const calls: CallLog = [];
  const sources = new InMemorySources(calls);
  const storage = new FakeStorage(calls);
  const queue = new FakeQueue(calls);
  const { limits, uploadEvents } = createUploadLimits(sources, overrides);
  const config = { limits: { ...DEFAULT_LIMITS, ...overrides } } as AppConfigService;
  sources.addNotebook(USER, NOTEBOOK);
  sources.addNotebook(OTHER_USER, OTHER_NOTEBOOK);
  const service = new SourcesService(
    sources as unknown as SourcesRepository,
    storage as unknown as StorageService,
    limits,
    config,
    queue as unknown as QueueService,
  );
  return { service, sources, storage, queue, calls, uploadEvents };
}

async function caught(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error('expected the promise to reject');
}

describe('SourcesService', () => {
  let f: Fixture;

  beforeEach(() => {
    vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    f = createService();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('upload', () => {
    it('stores the file under {userId}/{sourceId} and creates a pending source', async () => {
      const source = await f.service.upload(USER, NOTEBOOK, {
        originalName: 'notizen.md',
        content: markdown,
      });

      expect(SourceSchema.parse(source)).toMatchObject({
        notebookId: NOTEBOOK,
        type: 'markdown',
        title: 'notizen.md',
        status: 'pending',
        error: null,
        isActive: true,
      });
      const path = `${USER}/${source.id}`;
      expect(f.storage.files.get(path)).toEqual({
        content: markdown,
        contentType: 'text/markdown; charset=utf-8',
      });
      expect(f.sources.rows[0]).toMatchObject({ userId: USER, storagePath: path });
    });

    it('runs the steps of PE-16 in order: limits, storage, database, then the job', async () => {
      const source = await f.service.upload(USER, NOTEBOOK, {
        originalName: 'a.txt',
        content: markdown,
      });

      expect(f.uploadEvents()).toBe(1);
      expect(f.calls).toEqual([
        `storage:upload:${source.id}`,
        `db:create:${source.id}`,
        `queue:enqueue:${source.id}`,
      ]);
    });

    it('enqueues the ingestion of the new source with its user', async () => {
      const source = await f.service.upload(USER, NOTEBOOK, {
        originalName: 'a.txt',
        content: markdown,
      });

      expect(f.queue.ingestionJobs).toEqual([{ sourceId: source.id, userId: USER }]);
    });

    it('removes file and row again when the job cannot be enqueued, and rethrows', async () => {
      f.queue.failNextEnqueue = true;

      await expect(
        f.service.upload(USER, NOTEBOOK, { originalName: 'a.txt', content: markdown }),
      ).rejects.toThrow('Queue unavailable');

      const id = f.calls[0]?.replace('storage:upload:', '');
      expect(f.calls).toEqual([
        `storage:upload:${id}`,
        `db:create:${id}`,
        `queue:enqueue:${id}`,
        `storage:remove:${id}`,
        `db:delete:${id}`,
      ]);
      expect(f.storage.files.size).toBe(0);
      expect(f.sources.rows).toEqual([]);
      // The upload was accepted, so it still counts.
      expect(f.uploadEvents()).toBe(1);
    });

    it('rethrows the enqueue error when discarding the source fails as well', async () => {
      f.queue.failNextEnqueue = true;
      f.storage.failRemove = true;

      await expect(
        f.service.upload(USER, NOTEBOOK, { originalName: 'a.txt', content: markdown }),
      ).rejects.toThrow('Queue unavailable');
      expect(f.sources.rows).toHaveLength(1);
    });

    it('detects a PDF by content, whatever its name, and stores it as application/pdf', async () => {
      const source = await f.service.upload(USER, NOTEBOOK, {
        originalName: 'bericht.txt',
        content: miniPdf(2),
      });

      expect(source.type).toBe('pdf');
      expect(f.storage.files.get(`${USER}/${source.id}`)?.contentType).toBe('application/pdf');
    });

    it('takes the title from the file name without path segments', async () => {
      const source = await f.service.upload(USER, NOTEBOOK, {
        originalName: 'C:\\Users\\x\\Größe.md',
        content: markdown,
      });

      expect(source.title).toBe('Größe.md');
    });

    it('rejects a binary file before it uses up the quota or reaches storage', async () => {
      const error = await caught(
        f.service.upload(USER, NOTEBOOK, { originalName: 'bild.txt', content: png }),
      );

      expect(error).toBeInstanceOf(UnsupportedFileError);
      expect(f.uploadEvents()).toBe(0);
      expect(f.calls).toEqual([]);
      expect(f.queue.ingestionJobs).toEqual([]);
    });

    it('accepts a PDF with exactly the maximum number of pages', async () => {
      f = createService({ maxPdfPages: 3 });

      await expect(
        f.service.upload(USER, NOTEBOOK, { originalName: 'x.pdf', content: miniPdf(3) }),
      ).resolves.toMatchObject({ type: 'pdf' });
    });

    it('rejects a PDF with more pages than allowed with 413, before the quota', async () => {
      f = createService({ maxPdfPages: 3 });

      const error = await caught(
        f.service.upload(USER, NOTEBOOK, { originalName: 'x.pdf', content: miniPdf(4) }),
      );

      expect(error).toBeInstanceOf(PayloadTooLargeError);
      expect(error).toMatchObject({ statusCode: 413, code: ErrorCode.PAYLOAD_TOO_LARGE });
      expect((error as Error).message).toContain('höchstens 3 Seiten');
      expect(f.uploadEvents()).toBe(0);
      expect(f.calls).toEqual([]);
    });

    it('rejects the 21st source of a notebook with 429 and stores nothing', async () => {
      for (let i = 0; i < DEFAULT_LIMITS.maxSourcesPerNotebook; i += 1) {
        await f.service.upload(USER, NOTEBOOK, { originalName: `${i}.txt`, content: markdown });
      }
      f.calls.length = 0;

      const error = await caught(
        f.service.upload(USER, NOTEBOOK, { originalName: '21.txt', content: markdown }),
      );

      expect(error).toBeInstanceOf(LimitExceededError);
      expect(error).toMatchObject({ statusCode: 429 });
      expect(f.calls).toEqual([]);
      expect(f.sources.countSources(USER, NOTEBOOK)).toBe(20);
    });

    it('removes the stored file again when the row cannot be written, and rethrows', async () => {
      f.sources.failNextCreate = true;

      await expect(
        f.service.upload(USER, NOTEBOOK, { originalName: 'a.txt', content: markdown }),
      ).rejects.toThrow('foreign key');

      expect(f.storage.files.size).toBe(0);
      expect(f.sources.rows).toEqual([]);
      expect(f.queue.ingestionJobs).toEqual([]);
    });

    it('rethrows the original error when removing the orphaned file fails as well', async () => {
      f.sources.failNextCreate = true;
      f.storage.failRemove = true;

      await expect(
        f.service.upload(USER, NOTEBOOK, { originalName: 'a.txt', content: markdown }),
      ).rejects.toThrow('foreign key');
    });
  });

  describe('addPastedText', () => {
    it('stores the text as a UTF-8 file under the path scheme, with an empty storage path', async () => {
      const source = await f.service.addPastedText(USER, NOTEBOOK, 'Notiz', 'Grüße aus Köln');

      expect(source).toMatchObject({ type: 'pasted', title: 'Notiz', status: 'pending' });
      expect(f.storage.files.get(`${USER}/${source.id}`)).toEqual({
        content: Buffer.from('Grüße aus Köln', 'utf8'),
        contentType: 'text/plain; charset=utf-8',
      });
      expect(f.sources.rows[0]?.storagePath).toBeNull();
      expect(f.uploadEvents()).toBe(1);
      expect(f.queue.ingestionJobs).toEqual([{ sourceId: source.id, userId: USER }]);
    });

    it('enforces a configured limit below the schema default with 413', async () => {
      f = createService({ maxPastedTextChars: 5 });

      await expect(
        f.service.addPastedText(USER, NOTEBOOK, 'Notiz', '12345'),
      ).resolves.toBeDefined();
      const error = await caught(f.service.addPastedText(USER, NOTEBOOK, 'Notiz', '123456'));

      expect(error).toBeInstanceOf(PayloadTooLargeError);
      expect(f.uploadEvents()).toBe(1);
    });

    it('counts towards the source limit like a file', async () => {
      f = createService({ maxSourcesPerNotebook: 1 });
      await f.service.upload(USER, NOTEBOOK, { originalName: 'a.txt', content: markdown });

      await expect(f.service.addPastedText(USER, NOTEBOOK, 'Notiz', 'Text')).rejects.toThrow(
        LimitExceededError,
      );
    });
  });

  describe('list and setActive', () => {
    it('lists the sources of the notebook, newest first', async () => {
      await f.service.addPastedText(USER, NOTEBOOK, 'Erste', 'a');
      await f.service.addPastedText(USER, NOTEBOOK, 'Zweite', 'b');
      await f.service.addPastedText(OTHER_USER, OTHER_NOTEBOOK, 'Fremde', 'c');

      const sources = await f.service.list(USER, NOTEBOOK);

      expect(sources.map((source) => source.title)).toEqual(['Zweite', 'Erste']);
    });

    it('deactivates and reactivates a source', async () => {
      const { id } = await f.service.addPastedText(USER, NOTEBOOK, 'Notiz', 'Text');

      await expect(f.service.setActive(USER, NOTEBOOK, id, false)).resolves.toMatchObject({
        isActive: false,
      });
      await expect(f.service.setActive(USER, NOTEBOOK, id, true)).resolves.toMatchObject({
        isActive: true,
      });
    });
  });

  describe('delete', () => {
    it('removes the storage file before the row (PE-22)', async () => {
      const { id } = await f.service.upload(USER, NOTEBOOK, {
        originalName: 'a.txt',
        content: markdown,
      });
      f.calls.length = 0;

      await f.service.delete(USER, NOTEBOOK, id);

      expect(f.calls).toEqual([`storage:remove:${id}`, `db:delete:${id}`]);
      expect(f.storage.files.size).toBe(0);
      expect(f.sources.rows).toEqual([]);
    });

    it('also removes the file of pasted text', async () => {
      const { id } = await f.service.addPastedText(USER, NOTEBOOK, 'Notiz', 'Text');

      await f.service.delete(USER, NOTEBOOK, id);

      expect(f.storage.files.size).toBe(0);
    });

    it('keeps the row when storage fails, so the delete can be retried', async () => {
      const { id } = await f.service.addPastedText(USER, NOTEBOOK, 'Notiz', 'Text');
      f.storage.failRemove = true;

      await expect(f.service.delete(USER, NOTEBOOK, id)).rejects.toThrow('Storage unavailable');
      expect(f.sources.rows).toHaveLength(1);

      f.storage.failRemove = false;
      await f.service.delete(USER, NOTEBOOK, id);
      expect(f.sources.rows).toEqual([]);
    });

    it('frees stock but not the daily upload quota', async () => {
      f = createService({ maxSourcesPerNotebook: 1 });
      const { id } = await f.service.addPastedText(USER, NOTEBOOK, 'Notiz', 'Text');

      await f.service.delete(USER, NOTEBOOK, id);
      await f.service.addPastedText(USER, NOTEBOOK, 'Neu', 'Text');

      expect(f.uploadEvents()).toBe(2);
    });
  });

  describe('removeNotebookFiles', () => {
    it('removes the files of all sources of the notebook and leaves the rows to the cascade', async () => {
      const a = await f.service.addPastedText(USER, NOTEBOOK, 'A', 'a');
      const b = await f.service.upload(USER, NOTEBOOK, { originalName: 'b.md', content: markdown });
      await f.service.addPastedText(OTHER_USER, OTHER_NOTEBOOK, 'Fremd', 'c');

      await f.service.removeNotebookFiles(USER, NOTEBOOK);

      expect([...f.storage.files.keys()]).toEqual([
        expect.stringMatching(new RegExp(`^${OTHER_USER}/`)),
      ]);
      expect(f.calls.at(-1)).toBe(`storage:remove:${a.id},${b.id}`);
      expect(f.sources.countSources(USER, NOTEBOOK)).toBe(2);
    });

    it("removes nothing for another user's notebook", async () => {
      await f.service.addPastedText(OTHER_USER, OTHER_NOTEBOOK, 'Fremd', 'c');

      await f.service.removeNotebookFiles(USER, OTHER_NOTEBOOK);

      expect(f.storage.files.size).toBe(1);
    });
  });

  // A source is only reachable through its own notebook of its own user:
  // every case answers exactly like a missing resource and changes nothing.
  describe('ownership of the source through the notebook', () => {
    let foreignSourceId: string;
    let ownSourceId: string;

    beforeEach(async () => {
      foreignSourceId = (await f.service.addPastedText(OTHER_USER, OTHER_NOTEBOOK, 'Fremd', 'x'))
        .id;
      ownSourceId = (await f.service.addPastedText(USER, NOTEBOOK, 'Eigen', 'y')).id;
      f.calls.length = 0;
    });

    const notebookActions = {
      list: (s: SourcesService, notebookId: string) => s.list(USER, notebookId),
      upload: (s: SourcesService, notebookId: string) =>
        s.upload(USER, notebookId, { originalName: 'a.txt', content: markdown }),
      addPastedText: (s: SourcesService, notebookId: string) =>
        s.addPastedText(USER, notebookId, 'Notiz', 'Text'),
    };

    describe.each(Object.entries(notebookActions))('%s', (_name, act) => {
      it("throws NotFoundError for another user's notebook, as for a missing one", async () => {
        const forbidden = await caught(act(f.service, OTHER_NOTEBOOK));
        const missing = await caught(act(f.service, MISSING_ID));

        expect(forbidden).toBeInstanceOf(NotFoundError);
        expect((forbidden as Error).message).toBe((missing as Error).message);
        expect(f.calls).toEqual([]);
        expect(f.uploadEvents()).toBe(2);
      });
    });

    const sourceActions = {
      setActive: (s: SourcesService, notebookId: string, sourceId: string) =>
        s.setActive(USER, notebookId, sourceId, false),
      delete: (s: SourcesService, notebookId: string, sourceId: string) =>
        s.delete(USER, notebookId, sourceId),
    };

    describe.each(Object.entries(sourceActions))('%s', (_name, act) => {
      it("throws NotFoundError for another user's source in their notebook", async () => {
        const forbidden = await caught(act(f.service, OTHER_NOTEBOOK, foreignSourceId));
        const missing = await caught(act(f.service, NOTEBOOK, MISSING_ID));

        expect(forbidden).toBeInstanceOf(NotFoundError);
        expect((forbidden as Error).message).toBe((missing as Error).message);
      });

      it("throws NotFoundError for another user's source addressed through an own notebook", async () => {
        await expect(act(f.service, NOTEBOOK, foreignSourceId)).rejects.toThrow(NotFoundError);
      });

      it('throws NotFoundError for an own source addressed through another notebook', async () => {
        f.sources.addNotebook(USER, MISSING_ID);

        await expect(act(f.service, MISSING_ID, ownSourceId)).rejects.toThrow(NotFoundError);
      });

      it("leaves the other user's source and file unchanged", async () => {
        await caught(act(f.service, OTHER_NOTEBOOK, foreignSourceId));

        expect(f.calls).toEqual([]);
        expect(f.storage.files.has(`${OTHER_USER}/${foreignSourceId}`)).toBe(true);
        await expect(f.service.list(OTHER_USER, OTHER_NOTEBOOK)).resolves.toEqual([
          expect.objectContaining({ id: foreignSourceId, isActive: true }),
        ]);
      });
    });
  });
});
