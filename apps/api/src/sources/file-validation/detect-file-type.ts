import type { SourceType } from '@notebooklm/shared';
import { UnsupportedFileError } from '../../common/errors';

/** The types an uploaded file can have; `pasted` only comes from the text endpoint. */
export type UploadedFileType = Exclude<SourceType, 'pasted'>;

const PDF_MAGIC = Buffer.from('%PDF-', 'ascii');

// The extension only tells text from markdown once the content has passed as
// UTF-8 (PE-15). It never decides whether a file is accepted as safe.
const TEXT_TYPE_BY_EXTENSION: Readonly<Record<string, UploadedFileType>> = {
  '.txt': 'text',
  '.md': 'markdown',
  '.markdown': 'markdown',
};

const CONTENT_TYPE_BY_SOURCE_TYPE: Readonly<Record<SourceType, string>> = {
  pdf: 'application/pdf',
  text: 'text/plain; charset=utf-8',
  markdown: 'text/markdown; charset=utf-8',
  pasted: 'text/plain; charset=utf-8',
};

/**
 * Detects the type of an uploaded file from its content (CLAUDE.md section 7
 * "Härtung", PE-15). A PDF is recognised by its magic bytes whatever its name,
 * so a renamed PDF is still processed as one. Everything else must decode as
 * strict UTF-8 and carry a text or markdown extension.
 *
 * @throws UnsupportedFileError for empty files, binary content and other extensions.
 */
export function detectFileType(content: Buffer, filename: string): UploadedFileType {
  if (startsWith(content, PDF_MAGIC)) {
    return 'pdf';
  }
  const textType = TEXT_TYPE_BY_EXTENSION[extensionOf(filename)];
  if (textType === undefined || !isUtf8Text(content)) {
    throw new UnsupportedFileError();
  }
  return textType;
}

/** The content type stored with a source file in the bucket. */
export function contentTypeFor(type: SourceType): string {
  return CONTENT_TYPE_BY_SOURCE_TYPE[type];
}

function startsWith(content: Buffer, prefix: Buffer): boolean {
  return content.subarray(0, prefix.length).equals(prefix);
}

/** Lower-case extension of the last path segment, or '' if there is none. */
function extensionOf(filename: string): string {
  // Browsers send the bare name, but some clients include a path with either separator.
  const name = filename.slice(Math.max(filename.lastIndexOf('/'), filename.lastIndexOf('\\')) + 1);
  const dot = name.lastIndexOf('.');
  // A leading dot marks a hidden file such as `.md`, not an extension.
  return dot > 0 ? name.slice(dot).toLowerCase() : '';
}

function isUtf8Text(content: Buffer): boolean {
  // An empty file can never produce a citable passage.
  if (content.length === 0) {
    return false;
  }
  // NUL is valid UTF-8 but never part of a text document, and Postgres text
  // columns reject it, so ingestion would fail later. It is the classic marker
  // of binary data that happens to decode.
  if (content.includes(0)) {
    return false;
  }
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(content);
    return true;
  } catch {
    return false;
  }
}
