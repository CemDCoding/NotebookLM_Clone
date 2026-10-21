import { NotebookSchema } from '@notebooklm/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { asRepositories, InMemoryNotebooks } from '../../test/support/in-memory-notebooks';
import { LimitExceededError, NotFoundError } from '../common/errors';
import type { LimitsService } from '../limits/limits.service';
import type { SourcesService } from '../sources/sources.service';
import { NotebooksService } from './notebooks.service';

const USER = '0b6c3f1e-1d2a-4c3b-9e4f-5a6b7c8d9e0f';
const OTHER_USER = '7d8e9f0a-1b2c-4d3e-8f4a-5b6c7d8e9f0a';
const MISSING_ID = '00000000-0000-4000-8000-000000000000';

describe('NotebooksService', () => {
  let store: InMemoryNotebooks;
  let assertCanCreateNotebook: ReturnType<typeof vi.fn<(userId: string) => Promise<void>>>;
  let removeNotebookFiles: ReturnType<
    typeof vi.fn<(userId: string, notebookId: string) => Promise<void>>
  >;
  let service: NotebooksService;

  beforeEach(() => {
    store = new InMemoryNotebooks();
    assertCanCreateNotebook = vi.fn<(userId: string) => Promise<void>>().mockResolvedValue();
    removeNotebookFiles = vi
      .fn<(userId: string, notebookId: string) => Promise<void>>()
      .mockResolvedValue();
    const limits = { assertCanCreateNotebook } as unknown as LimitsService;
    const sources = { removeNotebookFiles } as unknown as SourcesService;
    service = new NotebooksService(asRepositories(store).notebooks, limits, sources);
  });

  it('creates a notebook after checking the limit for that user', async () => {
    const notebook = await service.create(USER, 'Forschung');

    expect(assertCanCreateNotebook).toHaveBeenCalledWith(USER);
    expect(notebook).toMatchObject({ title: 'Forschung', sourceCount: 0 });
    expect(NotebookSchema.safeParse(notebook).success).toBe(true);
  });

  it('does not create a notebook when the limit is reached', async () => {
    assertCanCreateNotebook.mockRejectedValue(new LimitExceededError('Limit erreicht.'));

    await expect(service.create(USER, 'Zu viel')).rejects.toThrow(LimitExceededError);
    expect(await store.countNotebooks(USER)).toBe(0);
  });

  it('lists only the own notebooks, newest first', async () => {
    await service.create(USER, 'Erstes');
    await service.create(OTHER_USER, 'Fremdes');
    await service.create(USER, 'Zweites');

    const notebooks = await service.list(USER);

    expect(notebooks.map((n) => n.title)).toEqual(['Zweites', 'Erstes']);
  });

  it('returns a single own notebook', async () => {
    const created = await service.create(USER, 'Forschung');

    await expect(service.get(USER, created.id)).resolves.toEqual(created);
  });

  it('renames a notebook and moves its updatedAt forward', async () => {
    const created = await service.create(USER, 'Alt');

    const renamed = await service.rename(USER, created.id, 'Neu');

    expect(renamed.title).toBe('Neu');
    expect(renamed.createdAt).toBe(created.createdAt);
    expect(Date.parse(renamed.updatedAt)).toBeGreaterThan(Date.parse(created.updatedAt));
  });

  it('deletes a notebook', async () => {
    const created = await service.create(USER, 'Weg damit');

    await service.delete(USER, created.id);

    await expect(service.list(USER)).resolves.toEqual([]);
  });

  it('removes the source files before the notebook row (PE-22)', async () => {
    const created = await service.create(USER, 'Mit Quellen');
    const order: string[] = [];
    removeNotebookFiles.mockImplementation(async () => {
      order.push(
        `files, notebook still there: ${(await store.findById(USER, created.id)) !== undefined}`,
      );
    });

    await service.delete(USER, created.id);

    expect(removeNotebookFiles).toHaveBeenCalledWith(USER, created.id);
    expect(order).toEqual(['files, notebook still there: true']);
    await expect(store.findById(USER, created.id)).resolves.toBeUndefined();
  });

  it('keeps the notebook when its files cannot be removed, so the delete can be retried', async () => {
    const created = await service.create(USER, 'Bleibt');
    removeNotebookFiles.mockRejectedValueOnce(new Error('Storage unavailable'));

    await expect(service.delete(USER, created.id)).rejects.toThrow('Storage unavailable');
    await expect(service.get(USER, created.id)).resolves.toEqual(created);

    await service.delete(USER, created.id);
    await expect(service.list(USER)).resolves.toEqual([]);
  });

  it("touches no files when deleting another user's notebook", async () => {
    const foreign = await service.create(OTHER_USER, 'Fremdes');

    await expect(service.delete(USER, foreign.id)).rejects.toThrow(NotFoundError);

    expect(removeNotebookFiles).not.toHaveBeenCalled();
  });

  describe.each([
    ['get', (s: NotebooksService, id: string) => s.get(USER, id)],
    ['rename', (s: NotebooksService, id: string) => s.rename(USER, id, 'Neu')],
    ['delete', (s: NotebooksService, id: string) => s.delete(USER, id)],
  ])('%s', (_name, act) => {
    it('throws NotFoundError for a missing notebook', async () => {
      await expect(act(service, MISSING_ID)).rejects.toThrow(NotFoundError);
    });

    it('throws the same NotFoundError for a notebook of another user and leaves it unchanged', async () => {
      const foreign = await service.create(OTHER_USER, 'Fremdes');

      const missing = await act(service, MISSING_ID).catch((e: unknown) => e);
      const forbidden = await act(service, foreign.id).catch((e: unknown) => e);

      expect(forbidden).toBeInstanceOf(NotFoundError);
      expect((forbidden as Error).message).toBe((missing as Error).message);
      await expect(service.get(OTHER_USER, foreign.id)).resolves.toEqual(foreign);
    });
  });
});
