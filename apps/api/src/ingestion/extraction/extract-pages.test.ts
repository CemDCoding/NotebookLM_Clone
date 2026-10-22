import { describe, expect, it } from 'vitest';
import { miniPdf } from '../../../test/support/mini-pdf';
import { extractPages, NO_READABLE_TEXT_MESSAGE } from './extract-pages';
import { IngestionError } from './ingestion-error';

/**
 * Builds a well-formed PDF whose pages carry real text, one line per entry.
 * Helvetica with WinAnsiEncoding covers German umlauts in Latin-1 bytes, so the
 * fixture needs no embedded font and no binary file in the repository.
 * An empty line list yields a page without any text, like a scanned page.
 */
function textPdf(pages: readonly (readonly string[])[]): Buffer {
  const fontId = 3;
  // Objects 1–3 are catalog, page tree and font; each page follows with its content stream.
  const pageId = (index: number) => 4 + index * 2;
  const contentsId = (index: number) => pageId(index) + 1;
  const pageIds = pages.map((_, index) => pageId(index));
  const objects: string[] = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pages.length} >>`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
  ];
  for (const [index, lines] of pages.entries()) {
    const shows = lines.map((line) => `(${escapePdfString(line)}) Tj T*`).join(' ');
    const stream = lines.length === 0 ? '' : `BT /F1 12 Tf 14 TL 72 770 Td ${shows} ET`;
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] ` +
        `/Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${contentsId(index)} 0 R >>`,
      `<< /Length ${Buffer.byteLength(stream, 'latin1')} >>\nstream\n${stream}\nendstream`,
    );
  }

  let body = '%PDF-1.4\n';
  const offsets = objects.map((object, index) => {
    const offset = Buffer.byteLength(body, 'latin1');
    body += `${index + 1} 0 obj\n${object}\nendobj\n`;
    return offset;
  });
  const xrefOffset = Buffer.byteLength(body, 'latin1');
  const entries = offsets.map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`);
  body +=
    `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${entries.join('')}` +
    `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(body, 'latin1');
}

function escapePdfString(text: string): string {
  return text.replace(/[\\()]/g, (character) => `\\${character}`);
}

describe('extractPages for PDFs', () => {
  it('returns the text of every page with its 1-based page number', async () => {
    const pdf = textPdf([['Erste Seite.'], ['Zweite Seite.'], ['Dritte Seite.']]);

    const pages = await extractPages(pdf, 'pdf');

    expect(pages.map((page) => page.page)).toEqual([1, 2, 3]);
    expect(pages[0]?.text).toContain('Erste Seite.');
    expect(pages[1]?.text).toContain('Zweite Seite.');
    expect(pages[2]?.text).toContain('Dritte Seite.');
  });

  it('keeps umlauts and special characters', async () => {
    const pages = await extractPages(textPdf([['Größe, Übung & Maß (100 %)']]), 'pdf');

    expect(pages[0]?.text).toContain('Größe, Übung & Maß (100 %)');
  });

  it('keeps blank pages between pages with text, so page numbers stay correct', async () => {
    const pages = await extractPages(textPdf([['Vorne.'], [], ['Hinten.']]), 'pdf');

    expect(pages.map((page) => page.page)).toEqual([1, 2, 3]);
    expect(pages[1]?.text.trim()).toBe('');
    expect(pages[2]?.text).toContain('Hinten.');
  });

  it('fails with a readable message for a PDF without a text layer', async () => {
    const extraction = extractPages(miniPdf(2), 'pdf');

    await expect(extraction).rejects.toThrow(IngestionError);
    await expect(extraction).rejects.toThrow(NO_READABLE_TEXT_MESSAGE);
  });

  it('fails permanently for a damaged PDF', async () => {
    await expect(extractPages(Buffer.from('%PDF-1.7\nkein PDF', 'latin1'), 'pdf')).rejects.toThrow(
      IngestionError,
    );
  });

  it("leaves the caller's buffer intact", async () => {
    const pdf = textPdf([['Inhalt.']]);
    const copy = Buffer.from(pdf);

    await extractPages(pdf, 'pdf');

    expect(pdf.equals(copy)).toBe(true);
  });
});

describe('extractPages for text, markdown and pasted text', () => {
  it.each(['text', 'markdown', 'pasted'] as const)(
    'returns the whole %s file as one page without a number',
    async (type) => {
      const content = '# Überschrift\n\nÄrger über Öl und Süßes.';

      await expect(extractPages(Buffer.from(content, 'utf8'), type)).resolves.toEqual([
        { page: null, text: content },
      ]);
    },
  );

  it('drops a leading byte order mark', async () => {
    const content = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from('Text', 'utf8')]);

    await expect(extractPages(content, 'text')).resolves.toEqual([{ page: null, text: 'Text' }]);
  });

  it.each(['', '   \n\n\t  '])('fails for a file without text (%j)', async (content) => {
    await expect(extractPages(Buffer.from(content, 'utf8'), 'text')).rejects.toThrow(
      NO_READABLE_TEXT_MESSAGE,
    );
  });

  it('fails permanently for content that is not valid UTF-8', async () => {
    await expect(extractPages(Buffer.from([0x48, 0xc3, 0x28]), 'markdown')).rejects.toThrow(
      IngestionError,
    );
  });
});
