import { getDocumentProxy } from 'unpdf';
import { UnsupportedFileError } from '../../common/errors';

// pdf.js' VerbosityLevel.ERRORS: its warnings about malformed but readable
// files would otherwise go straight to stdout, outside the structured logger.
const PDFJS_VERBOSITY_ERRORS = 0;

/**
 * Counts the pages of a PDF so the upload can be checked against
 * `MAX_PDF_PAGES` before anything is stored.
 *
 * @throws UnsupportedFileError if the PDF is damaged or password-protected.
 */
export async function countPdfPages(content: Buffer): Promise<number> {
  let document;
  try {
    // pdf.js takes ownership of the bytes it gets and may detach their buffer.
    // A copy keeps the caller's Buffer (which may share Node's buffer pool) intact.
    document = await getDocumentProxy(new Uint8Array(content), {
      verbosity: PDFJS_VERBOSITY_ERRORS,
    });
  } catch {
    // The parser's message describes the file's internals and adds nothing for the user.
    throw new UnsupportedFileError(
      'Die PDF-Datei konnte nicht gelesen werden. Sie ist möglicherweise beschädigt oder passwortgeschützt.',
    );
  }
  try {
    return document.numPages;
  } finally {
    // The bundled pdf.js frees a document through its loading task, as unpdf does itself.
    await document.loadingTask.destroy();
  }
}
