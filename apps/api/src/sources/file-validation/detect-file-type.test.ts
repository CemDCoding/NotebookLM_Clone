import { ErrorCode } from '@notebooklm/shared';
import { describe, expect, it } from 'vitest';
import { UnsupportedFileError } from '../../common/errors';
import { contentTypeFor, detectFileType } from './detect-file-type';

const pdfBytes = Buffer.from('%PDF-1.7\n%âãÏÓ\n1 0 obj\n<<>>\nendobj\n', 'latin1');
// Start of a PNG: invalid UTF-8 (0x89) and NUL bytes, like most binary formats.
const pngBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);
const germanText = Buffer.from('Größenänderung: Übermäßig schöne Äpfel für 5 €.\n', 'utf8');

function rejection(content: Buffer, filename: string): unknown {
  try {
    detectFileType(content, filename);
  } catch (error) {
    return error;
  }
  throw new Error('expected detectFileType to throw');
}

describe('detectFileType', () => {
  it('detects a PDF by its magic bytes', () => {
    expect(detectFileType(pdfBytes, 'bericht.pdf')).toBe('pdf');
  });

  it('detects a PDF renamed to .txt as pdf', () => {
    expect(detectFileType(pdfBytes, 'bericht.txt')).toBe('pdf');
  });

  it('recognises UTF-8 text with umlauts', () => {
    expect(detectFileType(germanText, 'notizen.txt')).toBe('text');
  });

  it('distinguishes markdown from text by the extension only', () => {
    expect(detectFileType(germanText, 'notizen.md')).toBe('markdown');
    expect(detectFileType(germanText, 'notizen.markdown')).toBe('markdown');
  });

  it('ignores the case of the extension and any path segments', () => {
    expect(detectFileType(germanText, 'C:\\Users\\x\\NOTIZEN.MD')).toBe('markdown');
    expect(detectFileType(germanText, 'ordner/a.b/notizen.TXT')).toBe('text');
  });

  it('accepts a UTF-8 byte order mark', () => {
    const withBom = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), germanText]);

    expect(detectFileType(withBom, 'notizen.txt')).toBe('text');
  });

  it('rejects a binary file renamed to .txt', () => {
    const error = rejection(pngBytes, 'bild.txt');

    expect(error).toBeInstanceOf(UnsupportedFileError);
    expect(error).toMatchObject({ statusCode: 415, code: ErrorCode.UNSUPPORTED_FILE });
  });

  it('rejects text that is not valid UTF-8, e.g. Latin-1', () => {
    expect(() => detectFileType(Buffer.from('Größe', 'latin1'), 'alt.txt')).toThrow(
      UnsupportedFileError,
    );
  });

  it('rejects valid UTF-8 that contains NUL bytes', () => {
    expect(() => detectFileType(Buffer.from('a\u0000b', 'utf8'), 'daten.txt')).toThrow(
      UnsupportedFileError,
    );
  });

  it('rejects an empty file', () => {
    expect(() => detectFileType(Buffer.alloc(0), 'leer.txt')).toThrow(UnsupportedFileError);
  });

  it('rejects a file whose PDF header is not at the very start', () => {
    expect(() => detectFileType(Buffer.from(' %PDF-1.7', 'ascii'), 'x.pdf')).toThrow(
      UnsupportedFileError,
    );
  });

  it.each(['notizen.html', 'notizen', '.md', 'skript.md.exe', 'notizen.txt.'])(
    'rejects text with the name %j',
    (filename) => {
      expect(() => detectFileType(germanText, filename)).toThrow(UnsupportedFileError);
    },
  );
});

describe('contentTypeFor', () => {
  it('stores text with an explicit UTF-8 charset', () => {
    expect(contentTypeFor('pdf')).toBe('application/pdf');
    expect(contentTypeFor('text')).toBe('text/plain; charset=utf-8');
    expect(contentTypeFor('markdown')).toBe('text/markdown; charset=utf-8');
    expect(contentTypeFor('pasted')).toBe('text/plain; charset=utf-8');
  });
});
