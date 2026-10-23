import { describe, expect, it } from 'vitest';
import { exportFileName } from './export-file-name';

describe('exportFileName', () => {
  it('uses the public app name and the UTC date of the export', () => {
    expect(exportFileName('2026-10-23T23:59:59.999Z')).toBe('quellenchat-export-2026-10-23.json');
  });
});
