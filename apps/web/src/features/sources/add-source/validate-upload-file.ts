import { ACCEPTED_UPLOAD_EXTENSIONS, DEFAULT_LIMITS } from '@notebooklm/shared';

const BYTES_PER_MB = 1024 * 1024;

/** The configured upload limit as shown to the user, e.g. „10 MB“. */
export const MAX_FILE_SIZE_LABEL = `${Math.floor(DEFAULT_LIMITS.maxFileSizeBytes / BYTES_PER_MB)} MB`;

function extensionOf(fileName: string): string {
  const dot = fileName.lastIndexOf('.');
  return dot === -1 ? '' : fileName.slice(dot).toLowerCase();
}

function isAcceptedExtension(extension: string): boolean {
  return (ACCEPTED_UPLOAD_EXTENSIONS as readonly string[]).includes(extension);
}

/**
 * Checks a file before it is sent, so the user gets immediate feedback. Returns German text for
 * the first problem, or `null`. Only a convenience: the API checks the content itself (PE-15).
 */
export function validateUploadFile(file: Pick<File, 'name' | 'size'>): string | null {
  if (!isAcceptedExtension(extensionOf(file.name))) {
    return 'Dieser Dateityp wird nicht unterstützt. Bitte lade eine PDF-, TXT- oder Markdown-Datei hoch.';
  }
  if (file.size > DEFAULT_LIMITS.maxFileSizeBytes) {
    return `Die Datei ist größer als ${MAX_FILE_SIZE_LABEL}. Bitte lade eine kleinere Datei hoch.`;
  }
  if (file.size === 0) {
    return 'Die Datei ist leer. Bitte wähle eine Datei mit Inhalt.';
  }
  return null;
}
