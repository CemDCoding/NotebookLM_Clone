import { NotebookSchema } from '@notebooklm/shared';
import { describe, expect, it } from 'vitest';
import { toNotebook } from './notebook.mapper';

describe('toNotebook', () => {
  it('emits dates as UTC ISO strings with Z, which NotebookSchema accepts', () => {
    // Postgres returns `timestamptz` in the session's zone; the Date is the same instant either way.
    const createdAt = new Date('2026-10-21T09:15:00+02:00');
    const updatedAt = new Date('2026-10-21T10:30:45.123+02:00');

    const notebook = toNotebook({
      id: '3f2b1c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d',
      title: 'Forschung',
      createdAt,
      updatedAt,
      sourceCount: 0,
    });

    expect(notebook.createdAt).toBe('2026-10-21T07:15:00.000Z');
    expect(notebook.updatedAt).toBe('2026-10-21T08:30:45.123Z');
    expect(NotebookSchema.parse(notebook)).toEqual(notebook);
  });

  it('would fail the schema with an offset instead of Z', () => {
    // Guards the reason for `toISOString()`: `z.iso.datetime()` rejects offsets by default.
    const withOffset = {
      id: '3f2b1c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d',
      title: 'Forschung',
      createdAt: '2026-10-21T09:15:00+02:00',
      updatedAt: '2026-10-21T09:15:00+02:00',
      sourceCount: 0,
    };

    expect(NotebookSchema.safeParse(withOffset).success).toBe(false);
  });
});
