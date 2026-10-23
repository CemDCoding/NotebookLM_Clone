import { Logger } from '@nestjs/common';
import { ExportSchema } from '@notebooklm/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SourceRecord } from '../sources/sources.repository';
import type {
  AccountData,
  AccountRepository,
  ExportMessageRecord,
  ExportNotebookRecord,
} from './account.repository';
import { AccountService } from './account.service';

const USER = '0b6c3f1e-1d2a-4c3b-9e4f-5a6b7c8d9e0f';
const OTHER_USER = '7d8e9f0a-1b2c-4d3e-8f4a-5b6c7d8e9f0a';
const NOTEBOOK = '3a4b5c6d-7e8f-4a0b-9c1d-2e3f4a5b6c7d';
const EMPTY_NOTEBOOK = '5c6d7e8f-9a0b-4c1d-8e2f-3a4b5c6d7e8f';
const OTHER_NOTEBOOK = '9f8e7d6c-5b4a-4c2d-8e1f-0a9b8c7d6e5f';
const SOURCE = '00000000-0000-4000-8000-00000000000a';
const OTHER_SOURCE = '00000000-0000-4000-8000-00000000000b';
const CHUNK = '00000000-0000-4000-8000-000000000001';
const NOW = new Date('2026-10-23T08:30:00.000Z');

interface OwnedRows {
  notebooks: (ExportNotebookRecord & { userId: string })[];
  sources: (SourceRecord & { userId: string })[];
  messages: (ExportMessageRecord & { userId: string })[];
}

/** Rows of two users; the fake repository filters them by owner like the real one. */
function rows(): OwnedRows {
  const at = (minute: number) => new Date(Date.UTC(2026, 9, 20, 10, minute));
  return {
    notebooks: [
      { userId: USER, id: NOTEBOOK, title: 'Forschung', createdAt: at(0), updatedAt: at(5) },
      { userId: USER, id: EMPTY_NOTEBOOK, title: 'Leer', createdAt: at(1), updatedAt: at(1) },
      {
        userId: OTHER_USER,
        id: OTHER_NOTEBOOK,
        title: 'Fremd',
        createdAt: at(2),
        updatedAt: at(2),
      },
    ],
    sources: [
      {
        userId: USER,
        id: SOURCE,
        notebookId: NOTEBOOK,
        type: 'pdf',
        title: 'Handbuch.pdf',
        status: 'ready',
        error: null,
        isActive: true,
        createdAt: at(1),
      },
      {
        userId: OTHER_USER,
        id: OTHER_SOURCE,
        notebookId: OTHER_NOTEBOOK,
        type: 'pasted',
        title: 'Fremde Quelle',
        status: 'ready',
        error: null,
        isActive: true,
        createdAt: at(2),
      },
    ],
    messages: [
      {
        userId: USER,
        id: '00000000-0000-4000-8000-0000000000c1',
        notebookId: NOTEBOOK,
        role: 'user',
        content: 'Wann endet die Frist?',
        model: null,
        citations: [],
        createdAt: at(3),
      },
      {
        userId: USER,
        id: '00000000-0000-4000-8000-0000000000c2',
        notebookId: NOTEBOOK,
        role: 'assistant',
        content: 'Am 31. März [1].',
        model: 'mistral-small-latest',
        citations: [{ n: 1, sourceId: SOURCE, chunkId: CHUNK, page: 3 }],
        createdAt: at(4),
      },
      {
        userId: OTHER_USER,
        id: '00000000-0000-4000-8000-0000000000c3',
        notebookId: OTHER_NOTEBOOK,
        role: 'user',
        content: 'Fremde Frage',
        model: null,
        citations: [],
        createdAt: at(5),
      },
    ],
  };
}

// The rows keep their `userId`; the service maps fields explicitly, so an
// extra column could not reach the export either.
function fakeRepository(data: OwnedRows): Pick<AccountRepository, 'readAll'> {
  return {
    readAll: (userId: string): Promise<AccountData> =>
      Promise.resolve({
        notebooks: data.notebooks.filter((row) => row.userId === userId),
        sources: data.sources.filter((row) => row.userId === userId),
        messages: data.messages.filter((row) => row.userId === userId),
      }),
  };
}

function serviceFor(data: OwnedRows): AccountService {
  return new AccountService(fakeRepository(data) as AccountRepository);
}

describe('AccountService.export', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('exports the own notebooks with their sources and chat, valid against the schema', async () => {
    const result = await serviceFor(rows()).export(USER);

    expect(ExportSchema.parse(result)).toEqual(result);
    expect(result).toMatchObject({ exportedAt: NOW.toISOString(), userId: USER });
    expect(result.notebooks.map((n) => n.id)).toEqual([NOTEBOOK, EMPTY_NOTEBOOK]);

    const [notebook, empty] = result.notebooks;
    expect(notebook).toMatchObject({
      title: 'Forschung',
      createdAt: '2026-10-20T10:00:00.000Z',
      updatedAt: '2026-10-20T10:05:00.000Z',
    });
    expect(notebook?.sources).toEqual([
      {
        id: SOURCE,
        type: 'pdf',
        title: 'Handbuch.pdf',
        status: 'ready',
        error: null,
        isActive: true,
        createdAt: '2026-10-20T10:01:00.000Z',
      },
    ]);
    expect(notebook?.messages.map((m) => m.role)).toEqual(['user', 'assistant']);
    expect(notebook?.messages[1]).toMatchObject({
      model: 'mistral-small-latest',
      citations: [{ n: 1, sourceId: SOURCE, chunkId: CHUNK, page: 3 }],
    });
    expect(empty).toMatchObject({ sources: [], messages: [] });
  });

  it('contains no data of another user', async () => {
    const output = JSON.stringify(await serviceFor(rows()).export(USER));

    expect(output).not.toContain(OTHER_USER);
    expect(output).not.toContain(OTHER_NOTEBOOK);
    expect(output).not.toContain(OTHER_SOURCE);
    expect(output).not.toContain('Fremd');
  });

  it('leaves out rows that do not belong to one of the own notebooks', async () => {
    const data = rows();
    const [source] = data.sources;
    const [message] = data.messages;
    if (!source || !message) throw new Error('fixture incomplete');
    data.sources.push({ ...source, id: OTHER_SOURCE, notebookId: OTHER_NOTEBOOK });
    data.messages.push({ ...message, content: 'Verirrt', notebookId: OTHER_NOTEBOOK });

    const output = JSON.stringify(await serviceFor(data).export(USER));

    expect(output).not.toContain(OTHER_SOURCE);
    expect(output).not.toContain('Verirrt');
  });

  it('exports an empty list for a user without notebooks', async () => {
    const result = await serviceFor(rows()).export('1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d');

    expect(ExportSchema.safeParse(result).success).toBe(true);
    expect(result.notebooks).toEqual([]);
  });

  it('drops invalid stored citations and logs only the message ID', async () => {
    const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const data = rows();
    const answer = data.messages[1];
    if (!answer) throw new Error('fixture incomplete');
    answer.citations = [...answer.citations, { n: 2, excerpt: 'geheimer Quelltext' }];

    const result = await serviceFor(data).export(USER);

    expect(result.notebooks[0]?.messages[1]?.citations).toHaveLength(1);
    expect(JSON.stringify(result)).not.toContain('geheimer Quelltext');
    expect(warn).toHaveBeenCalledWith({
      message: 'Dropped invalid stored citations',
      messageId: answer.id,
    });
  });

  it('never logs content or titles', async () => {
    const log = vi.spyOn(Logger.prototype, 'log');

    await serviceFor(rows()).export(USER);

    const logged = JSON.stringify(log.mock.calls);
    expect(logged).not.toContain('Forschung');
    expect(logged).not.toContain('Frist');
    expect(logged).not.toContain('Handbuch');
  });
});
