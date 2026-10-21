/**
 * Builds a minimal, well-formed PDF with empty pages and a correct
 * cross-reference table, so tests need no binary fixture file.
 */
export function miniPdf(pageCount: number): Buffer {
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
