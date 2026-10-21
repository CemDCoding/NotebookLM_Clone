import { describe, expect, it } from 'vitest';
import {
  ACCEPTED_UPLOAD_EXTENSIONS,
  CreatePastedSourceRequestSchema,
  DEFAULT_LIMITS,
  SourceListResponseSchema,
  SourceParamsSchema,
  SourceSchema,
  SourceStatusSchema,
  SourceTypeSchema,
  UpdateSourceRequestSchema,
} from './index';

const source = {
  id: '7b1e2c3d-4f5a-4b6c-8d7e-9f0a1b2c3d4e',
  notebookId: '3f6c1f0e-8b2a-4c1d-9e57-2a4b6d8f0a11',
  type: 'pdf',
  title: 'Handbuch.pdf',
  status: 'pending',
  error: null,
  isActive: true,
  createdAt: '2026-10-21T10:00:00.000Z',
};

describe('SourceTypeSchema and SourceStatusSchema', () => {
  it('accept exactly the documented values', () => {
    expect(SourceTypeSchema.options).toEqual(['pdf', 'text', 'markdown', 'pasted']);
    expect(SourceStatusSchema.options).toEqual(['pending', 'processing', 'ready', 'failed']);
  });

  it('reject unknown values', () => {
    expect(SourceTypeSchema.safeParse('url').success).toBe(false);
    expect(SourceStatusSchema.safeParse('done').success).toBe(false);
  });
});

describe('SourceSchema', () => {
  it('accepts a valid source', () => {
    expect(SourceSchema.parse(source)).toEqual(source);
  });

  it('accepts a failed source with an error message', () => {
    const failed = { ...source, status: 'failed', error: 'Die PDF enthält keinen Text.' };
    expect(SourceSchema.safeParse(failed).success).toBe(true);
  });

  it('requires error to be present, even when null', () => {
    const withoutError: Partial<typeof source> = { ...source };
    delete withoutError.error;
    expect(SourceSchema.safeParse(withoutError).success).toBe(false);
  });

  it('rejects invalid ids, a non-ISO date and a non-boolean isActive', () => {
    expect(SourceSchema.safeParse({ ...source, id: 'abc' }).success).toBe(false);
    expect(SourceSchema.safeParse({ ...source, notebookId: 'abc' }).success).toBe(false);
    expect(SourceSchema.safeParse({ ...source, createdAt: 'today' }).success).toBe(false);
    expect(SourceSchema.safeParse({ ...source, isActive: 'true' }).success).toBe(false);
  });
});

describe('SourceListResponseSchema', () => {
  it('accepts an empty and a filled list', () => {
    expect(SourceListResponseSchema.safeParse({ sources: [] }).success).toBe(true);
    expect(SourceListResponseSchema.safeParse({ sources: [source] }).success).toBe(true);
  });

  it('rejects a list containing an invalid source', () => {
    expect(SourceListResponseSchema.safeParse({ sources: [{ id: 'x' }] }).success).toBe(false);
  });
});

describe('CreatePastedSourceRequestSchema', () => {
  const max = DEFAULT_LIMITS.maxPastedTextChars;

  it('accepts 500,000 characters and rejects 500,001', () => {
    expect(max).toBe(500_000);
    const ok = CreatePastedSourceRequestSchema.safeParse({ title: 'Notiz', text: 'a'.repeat(max) });
    const tooLong = CreatePastedSourceRequestSchema.safeParse({
      title: 'Notiz',
      text: 'a'.repeat(max + 1),
    });
    expect(ok.success).toBe(true);
    expect(tooLong.success).toBe(false);
  });

  it('rejects empty and whitespace-only text', () => {
    expect(CreatePastedSourceRequestSchema.safeParse({ title: 'Notiz', text: '' }).success).toBe(
      false,
    );
    expect(
      CreatePastedSourceRequestSchema.safeParse({ title: 'Notiz', text: ' \n\t ' }).success,
    ).toBe(false);
  });

  it('keeps the text unchanged, including surrounding whitespace', () => {
    const text = '  Erster Absatz.\n\nZweiter Absatz mit Umlauten: äöüß.  ';
    expect(CreatePastedSourceRequestSchema.parse({ title: 'Notiz', text }).text).toBe(text);
  });

  it('trims the title and enforces 1 to 200 characters', () => {
    const parse = (title: string) =>
      CreatePastedSourceRequestSchema.safeParse({ title, text: 'Inhalt' });
    expect(CreatePastedSourceRequestSchema.parse({ title: '  Notiz  ', text: 'x' }).title).toBe(
      'Notiz',
    );
    expect(parse('').success).toBe(false);
    expect(parse('   ').success).toBe(false);
    expect(parse('a'.repeat(200)).success).toBe(true);
    expect(parse('a'.repeat(201)).success).toBe(false);
  });

  it('rejects missing fields', () => {
    expect(CreatePastedSourceRequestSchema.safeParse({ title: 'Notiz' }).success).toBe(false);
    expect(CreatePastedSourceRequestSchema.safeParse({ text: 'Inhalt' }).success).toBe(false);
  });
});

describe('UpdateSourceRequestSchema', () => {
  it('accepts a boolean isActive', () => {
    expect(UpdateSourceRequestSchema.parse({ isActive: false })).toEqual({ isActive: false });
  });

  it('rejects a missing or non-boolean isActive', () => {
    expect(UpdateSourceRequestSchema.safeParse({}).success).toBe(false);
    expect(UpdateSourceRequestSchema.safeParse({ isActive: 'false' }).success).toBe(false);
  });
});

describe('SourceParamsSchema', () => {
  it('accepts two UUIDs and rejects anything else', () => {
    const params = { id: source.notebookId, sourceId: source.id };
    expect(SourceParamsSchema.safeParse(params).success).toBe(true);
    expect(SourceParamsSchema.safeParse({ ...params, sourceId: '1' }).success).toBe(false);
    expect(SourceParamsSchema.safeParse({ ...params, id: '1' }).success).toBe(false);
    expect(SourceParamsSchema.safeParse({ id: source.notebookId }).success).toBe(false);
  });
});

describe('ACCEPTED_UPLOAD_EXTENSIONS', () => {
  it('lists the extensions from PE-15', () => {
    expect(ACCEPTED_UPLOAD_EXTENSIONS).toEqual(['.pdf', '.txt', '.md', '.markdown']);
  });
});
