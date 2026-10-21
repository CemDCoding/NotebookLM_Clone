import { DEFAULT_LIMITS } from '@notebooklm/shared';
import { describe, expect, it } from 'vitest';
import { validateUploadFile } from './validate-upload-file';

describe('validateUploadFile', () => {
  it.each(['Bericht.pdf', 'notizen.txt', 'README.md', 'Kapitel.MARKDOWN'])('accepts %s', (name) => {
    expect(validateUploadFile({ name, size: 1024 })).toBeNull();
  });

  it.each(['bild.png', 'tabelle.xlsx', 'ohne-endung', 'bericht.pdf.exe'])(
    'rejects %s by its extension',
    (name) => {
      expect(validateUploadFile({ name, size: 1024 })).toContain('Dateityp wird nicht unterstützt');
    },
  );

  it('accepts a file of exactly the size limit', () => {
    expect(validateUploadFile({ name: 'a.pdf', size: DEFAULT_LIMITS.maxFileSizeBytes })).toBeNull();
  });

  it('rejects a file above the size limit', () => {
    expect(validateUploadFile({ name: 'a.pdf', size: DEFAULT_LIMITS.maxFileSizeBytes + 1 })).toBe(
      'Die Datei ist größer als 10 MB. Bitte lade eine kleinere Datei hoch.',
    );
  });

  it('rejects an empty file', () => {
    expect(validateUploadFile({ name: 'a.txt', size: 0 })).toContain('Die Datei ist leer');
  });
});
