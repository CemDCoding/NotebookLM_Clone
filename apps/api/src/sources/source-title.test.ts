import { SOURCE_TITLE_MAX_LENGTH } from '@notebooklm/shared';
import { describe, expect, it } from 'vitest';
import { FALLBACK_SOURCE_TITLE, titleFromFilename } from './source-title';

describe('titleFromFilename', () => {
  it('keeps a plain file name with its extension', () => {
    expect(titleFromFilename('Jahresbericht 2025.pdf')).toBe('Jahresbericht 2025.pdf');
  });

  it.each([
    ['C:\\Users\\x\\bericht.pdf', 'bericht.pdf'],
    ['../../etc/passwd.txt', 'passwd.txt'],
    ['ordner/unter\\notizen.md', 'notizen.md'],
  ])('drops the path segments of %j', (filename, title) => {
    expect(titleFromFilename(filename)).toBe(title);
  });

  it('removes control characters and surrounding whitespace', () => {
    expect(titleFromFilename('  no\u0000ti\nzen.md\t ')).toBe('notizen.md');
  });

  it.each(['', '   ', 'C:\\', 'ordner/', '\u0000\u0007'])(
    'falls back to a generic title for %j',
    (filename) => {
      expect(titleFromFilename(filename)).toBe(FALLBACK_SOURCE_TITLE);
    },
  );

  it(`shortens long names to ${SOURCE_TITLE_MAX_LENGTH} characters`, () => {
    const title = titleFromFilename(`${'a'.repeat(300)}.pdf`);

    expect(title).toBe('a'.repeat(SOURCE_TITLE_MAX_LENGTH));
  });

  it('never splits a character outside the BMP when shortening', () => {
    const title = titleFromFilename(`${'a'.repeat(SOURCE_TITLE_MAX_LENGTH - 1)}😀.txt`);

    expect(title).toBe('a'.repeat(SOURCE_TITLE_MAX_LENGTH - 1));
  });

  it('keeps umlauts', () => {
    expect(titleFromFilename('Übersicht Größen.md')).toBe('Übersicht Größen.md');
  });
});
