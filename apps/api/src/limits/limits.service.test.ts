import { ErrorCode } from '@notebooklm/shared';
import { describe, expect, it } from 'vitest';
import { asRepositories, InMemoryNotebooks } from '../../test/support/in-memory-notebooks';
import { LimitExceededError } from '../common/errors';
import type { AppConfigService } from '../config';
import { LimitsService } from './limits.service';

const USER = '0b6c3f1e-1d2a-4c3b-9e4f-5a6b7c8d9e0f';
const OTHER_USER = '7d8e9f0a-1b2c-4d3e-8f4a-5b6c7d8e9f0a';

function createService(maxNotebooksPerUser: number): {
  limits: LimitsService;
  store: InMemoryNotebooks;
} {
  const store = new InMemoryNotebooks();
  const config = { limits: { maxNotebooksPerUser } } as AppConfigService;
  return { limits: new LimitsService(asRepositories(store).limits, config), store };
}

async function fill(store: InMemoryNotebooks, userId: string, count: number): Promise<void> {
  for (let i = 0; i < count; i += 1) {
    await store.create(userId, `Notebook ${i + 1}`);
  }
}

describe('LimitsService.assertCanCreateNotebook', () => {
  it('allows a notebook below the limit', async () => {
    const { limits, store } = createService(3);
    await fill(store, USER, 2);

    await expect(limits.assertCanCreateNotebook(USER)).resolves.toBeUndefined();
  });

  it('rejects a notebook at the limit with a German message naming the limit', async () => {
    const { limits, store } = createService(3);
    await fill(store, USER, 3);

    const error = await limits.assertCanCreateNotebook(USER).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(LimitExceededError);
    expect(error).toMatchObject({ statusCode: 429, code: ErrorCode.LIMIT_EXCEEDED });
    expect((error as Error).message).toContain('höchstens 3 Notebooks');
  });

  it('counts only the notebooks of the given user', async () => {
    const { limits, store } = createService(3);
    await fill(store, OTHER_USER, 3);

    await expect(limits.assertCanCreateNotebook(USER)).resolves.toBeUndefined();
  });

  it('frees a slot when a notebook is deleted', async () => {
    const { limits, store } = createService(1);
    const notebook = await store.create(USER, 'Einziges Notebook');
    await expect(limits.assertCanCreateNotebook(USER)).rejects.toThrow(LimitExceededError);

    await store.delete(USER, notebook.id);

    await expect(limits.assertCanCreateNotebook(USER)).resolves.toBeUndefined();
  });
});
