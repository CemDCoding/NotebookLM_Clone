import type { SourceType } from '@notebooklm/shared';
import { extractText, getDocumentProxy } from 'unpdf';
import { IngestionError } from './ingestion-error';

/** The text of one page. Text and markdown have no pages and form a single one with `page = null`. */
export interface ExtractedPage {
  page: number | null;
  text: string;
}

export const NO_READABLE_TEXT_MESSAGE =
  'Die Datei enthält keinen lesbaren Text (z. B. ein gescanntes PDF).';

const UNREADABLE_PDF_MESSAGE =
  'Die PDF-Datei konnte nicht gelesen werden. Sie ist möglicherweise beschädigt oder passwortgeschützt.';

const INVALID_TEXT_MESSAGE = 'Die Datei konnte nicht als UTF-8-Text gelesen werden.';

// pdf.js' VerbosityLevel.ERRORS: its warnings about malformed but readable
// files would otherwise go straight to stdout, outside the structured logger.
const PDFJS_VERBOSITY_ERRORS = 0;

/**
 * Extracts the text of a stored source page by page (apps/api/CLAUDE.md
 * "sources und ingestion", step 1). PDF pages keep their 1-based number so
 * citations can name it. Pasted text is stored as a UTF-8 file (PE-16) and
 * takes the same path as text and markdown.
 *
 * The returned pages may contain empty ones, for example a blank PDF page;
 * chunking skips them.
 *
 * @throws IngestionError if the file cannot be read or contains no readable text at all.
 */
export async function extractPages(content: Buffer, type: SourceType): Promise<ExtractedPage[]> {
  const pages = type === 'pdf' ? await extractPdfPages(content) : [extractTextPage(content)];
  if (pages.every((page) => page.text.trim() === '')) {
    throw new IngestionError(NO_READABLE_TEXT_MESSAGE);
  }
  return pages;
}

async function extractPdfPages(content: Buffer): Promise<ExtractedPage[]> {
  let document;
  try {
    // pdf.js takes ownership of the bytes it gets and may detach their buffer.
    // A copy keeps the caller's Buffer (which may share Node's buffer pool) intact.
    document = await getDocumentProxy(new Uint8Array(content), {
      verbosity: PDFJS_VERBOSITY_ERRORS,
    });
  } catch {
    // The upload already parsed the file once, so this is a permanent defect.
    // The parser's message describes the file's internals and adds nothing for the user.
    throw new IngestionError(UNREADABLE_PDF_MESSAGE);
  }
  try {
    const { text } = await extractText(document, { mergePages: false });
    return text.map((pageText, index) => ({ page: index + 1, text: pageText }));
  } finally {
    // unpdf leaves a document it did not open itself to the caller.
    await document.loadingTask.destroy();
  }
}

function extractTextPage(content: Buffer): ExtractedPage {
  try {
    // The upload checked the encoding already. Decoding strictly again keeps
    // replacement characters out of the chunks should a stored file ever differ.
    // TextDecoder drops a leading byte order mark by default.
    const text = new TextDecoder('utf-8', { fatal: true }).decode(content);
    return { page: null, text };
  } catch {
    throw new IngestionError(INVALID_TEXT_MESSAGE);
  }
}
