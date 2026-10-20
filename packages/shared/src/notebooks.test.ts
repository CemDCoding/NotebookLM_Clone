import { describe, expect, it } from 'vitest';
import {
  CreateNotebookRequestSchema,
  NotebookIdParamsSchema,
  NotebookListResponseSchema,
  NotebookSchema,
  RenameNotebookRequestSchema,
} from './index';

const notebook = {
  id: '3f6c1f0e-8b2a-4c1d-9e57-2a4b6d8f0a11',
  title: 'Demo',
  createdAt: '2026-10-19T10:00:00.000Z',
  updatedAt: '2026-10-19T11:30:00.000Z',
  sourceCount: 2,
};

describe('NotebookSchema', () => {
  it('accepts a valid notebook', () => {
    expect(NotebookSchema.parse(notebook)).toEqual(notebook);
  });

  it('rejects dates that are not ISO strings', () => {
    expect(NotebookSchema.safeParse({ ...notebook, createdAt: 'yesterday' }).success).toBe(false);
    expect(NotebookSchema.safeParse({ ...notebook, updatedAt: 1760868000000 }).success).toBe(false);
  });

  it('rejects an invalid id and a negative or fractional source count', () => {
    expect(NotebookSchema.safeParse({ ...notebook, id: 'abc' }).success).toBe(false);
    expect(NotebookSchema.safeParse({ ...notebook, sourceCount: -1 }).success).toBe(false);
    expect(NotebookSchema.safeParse({ ...notebook, sourceCount: 1.5 }).success).toBe(false);
  });
});

describe('NotebookListResponseSchema', () => {
  it('accepts an empty and a filled list', () => {
    expect(NotebookListResponseSchema.safeParse({ notebooks: [] }).success).toBe(true);
    expect(NotebookListResponseSchema.safeParse({ notebooks: [notebook] }).success).toBe(true);
  });

  it('rejects a list containing an invalid notebook', () => {
    expect(NotebookListResponseSchema.safeParse({ notebooks: [{ id: 'x' }] }).success).toBe(false);
  });
});

describe.each([
  ['CreateNotebookRequestSchema', CreateNotebookRequestSchema],
  ['RenameNotebookRequestSchema', RenameNotebookRequestSchema],
])('%s', (_name, schema) => {
  it('trims the title', () => {
    expect(schema.parse({ title: '  Mein Notebook  ' })).toEqual({ title: 'Mein Notebook' });
  });

  it('rejects empty and whitespace-only titles', () => {
    expect(schema.safeParse({ title: '' }).success).toBe(false);
    expect(schema.safeParse({ title: '   ' }).success).toBe(false);
  });

  it('accepts 200 characters and rejects 201', () => {
    expect(schema.safeParse({ title: 'a'.repeat(200) }).success).toBe(true);
    expect(schema.safeParse({ title: 'a'.repeat(201) }).success).toBe(false);
  });

  it('counts the trimmed length, not the raw length', () => {
    expect(schema.safeParse({ title: ` ${'a'.repeat(200)} ` }).success).toBe(true);
  });

  it('rejects a missing or non-string title', () => {
    expect(schema.safeParse({}).success).toBe(false);
    expect(schema.safeParse({ title: 42 }).success).toBe(false);
  });
});

describe('NotebookIdParamsSchema', () => {
  it('accepts a UUID and rejects anything else', () => {
    expect(NotebookIdParamsSchema.safeParse({ id: notebook.id }).success).toBe(true);
    expect(NotebookIdParamsSchema.safeParse({ id: '123' }).success).toBe(false);
    expect(NotebookIdParamsSchema.safeParse({}).success).toBe(false);
  });
});
