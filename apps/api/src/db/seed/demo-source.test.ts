import { DEFAULT_LIMITS } from '@notebooklm/shared';
import { describe, expect, it } from 'vitest';
import { detectFileType } from '../../sources/file-validation/detect-file-type';
import { loadDemoSource } from './demo-source';

describe('loadDemoSource', () => {
  const source = loadDemoSource();
  const text = source.content.toString('utf8');

  it('is a markdown file that passes the same content check as an upload', () => {
    expect(source.type).toBe('markdown');
    expect(source.contentType).toBe('text/markdown; charset=utf-8');
    expect(detectFileType(source.content, 'demo-source.md')).toBe('markdown');
  });

  it('fits the upload limits', () => {
    expect(source.content.length).toBeLessThanOrEqual(DEFAULT_LIMITS.maxFileSizeBytes);
    expect(text.length).toBeLessThanOrEqual(DEFAULT_LIMITS.maxPastedTextChars);
  });

  // PE-17: about 3–5 pages, so the demo notebook yields several chunks to cite.
  it('has the length of a few pages', () => {
    expect(text.length).toBeGreaterThan(6_000);
    expect(text.length).toBeLessThan(20_000);
  });

  // The demo question asks for a fact no model can know from training.
  it('contains the unique fact for the demo question', () => {
    expect(text).toContain('Eule namens Fidelia');
  });
});
