import { describe, expect, it } from 'vitest';
import { ExportSchema } from './index';

const userId = '7d1f4c52-3a8e-4b6f-9c20-5e8a1b3d4f60';
const notebookId = '3f6c1f0e-8b2a-4c1d-9e57-2a4b6d8f0a11';
const sourceId = '9b2e6a14-5c7d-4e83-a1f0-6d3c8b2e7a45';
const chunkId = 'c4a8d2f6-1e3b-4a59-8f7c-0b9d5e1a3c72';

const source = {
  id: sourceId,
  type: 'pdf',
  title: 'Handbuch',
  status: 'ready',
  error: null,
  isActive: true,
  createdAt: '2026-10-19T10:00:00.000Z',
};

const answer = {
  id: 'e5b3a7c9-2d4f-4681-b0a3-7c9e1f5d8a24',
  role: 'assistant',
  content: 'Das steht im Handbuch [1].',
  model: 'mistral-small-latest',
  citations: [{ n: 1, sourceId, chunkId, page: 3 }],
  createdAt: '2026-10-19T10:05:00.000Z',
};

const data = {
  exportedAt: '2026-10-20T08:00:00.000Z',
  userId,
  notebooks: [
    {
      id: notebookId,
      title: 'Demo',
      createdAt: '2026-10-19T09:00:00.000Z',
      updatedAt: '2026-10-19T10:05:00.000Z',
      sources: [source],
      messages: [answer],
    },
  ],
};

describe('ExportSchema', () => {
  it('accepts a full export and an empty one', () => {
    expect(ExportSchema.parse(data)).toEqual(data);
    expect(ExportSchema.safeParse({ ...data, notebooks: [] }).success).toBe(true);
  });

  it('accepts a notebook without sources and messages', () => {
    const empty = { ...data.notebooks[0], sources: [], messages: [] };
    expect(ExportSchema.safeParse({ ...data, notebooks: [empty] }).success).toBe(true);
  });

  it('rejects a missing userId or exportedAt and invalid dates', () => {
    expect(ExportSchema.safeParse({ ...data, userId: undefined }).success).toBe(false);
    expect(ExportSchema.safeParse({ ...data, exportedAt: undefined }).success).toBe(false);
    expect(ExportSchema.safeParse({ ...data, exportedAt: 'today' }).success).toBe(false);
  });

  it('rejects an invalid message role and citation', () => {
    const withMessage = (message: unknown) => ({
      ...data,
      notebooks: [{ ...data.notebooks[0], messages: [message] }],
    });
    expect(ExportSchema.safeParse(withMessage({ ...answer, role: 'system' })).success).toBe(false);
    const badCitation = { ...answer, citations: [{ n: 0, sourceId, chunkId, page: null }] };
    expect(ExportSchema.safeParse(withMessage(badCitation)).success).toBe(false);
  });

  it('keeps null pages of text sources in stored citations', () => {
    const textAnswer = { ...answer, citations: [{ n: 1, sourceId, chunkId, page: null }] };
    const parsed = ExportSchema.parse({
      ...data,
      notebooks: [{ ...data.notebooks[0], messages: [textAnswer] }],
    });
    expect(parsed.notebooks[0]?.messages[0]?.citations[0]?.page).toBeNull();
  });

  it('drops source content, chunks, embeddings and citation text', () => {
    const leaky = {
      ...data,
      notebooks: [
        {
          ...data.notebooks[0],
          chunks: [{ id: chunkId, content: 'secret' }],
          sources: [{ ...source, text: 'secret', content: 'secret', embedding: [0.1] }],
          messages: [
            {
              ...answer,
              citations: [{ n: 1, sourceId, chunkId, page: 3, content: 'secret', excerpt: 'secret' }],
            },
          ],
        },
      ],
    };
    const output = JSON.stringify(ExportSchema.parse(leaky));
    expect(output).not.toContain('secret');
    expect(output).not.toContain('embedding');
    expect(output).not.toContain('chunks');
  });
});
