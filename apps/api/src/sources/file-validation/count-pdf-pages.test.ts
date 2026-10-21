import { describe, expect, it } from 'vitest';
import { UnsupportedFileError } from '../../common/errors';
import { countPdfPages } from './count-pdf-pages';

/**
 * Builds a minimal, well-formed PDF with empty pages and a correct
 * cross-reference table, so the test needs no binary fixture file.
 */
function miniPdf(pageCount: number): Buffer {
  const pageIds = Array.from({ length: pageCount }, (_, index) => index + 3);
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageCount} >>`,
    ...pageIds.map(() => '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] >>'),
  ];

  let body = '%PDF-1.4\n';
  const offsets = objects.map((object, index) => {
    const offset = body.length;
    body += `${index + 1} 0 obj\n${object}\nendobj\n`;
    return offset;
  });
  const xrefOffset = body.length;
  const entries = offsets.map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`);
  body +=
    `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${entries.join('')}` +
    `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(body, 'latin1');
}

describe('countPdfPages', () => {
  it('counts the pages of a mini PDF', async () => {
    await expect(countPdfPages(miniPdf(1))).resolves.toBe(1);
    await expect(countPdfPages(miniPdf(3))).resolves.toBe(3);
  });

  it("leaves the caller's buffer intact", async () => {
    const pdf = miniPdf(2);
    const copy = Buffer.from(pdf);

    await countPdfPages(pdf);

    expect(pdf.equals(copy)).toBe(true);
  });

  it('rejects a file that only starts like a PDF', async () => {
    await expect(countPdfPages(Buffer.from('%PDF-1.7\nkein PDF', 'latin1'))).rejects.toThrow(
      UnsupportedFileError,
    );
  });
});
