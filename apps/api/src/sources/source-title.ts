import { SOURCE_TITLE_MAX_LENGTH } from '@notebooklm/shared';

/** Used when a file name has nothing left after cleaning, e.g. `C:\` or only control characters. */
export const FALLBACK_SOURCE_TITLE = 'Unbenannte Datei';

// Control characters have no place in a title shown in the UI and could break log or export lines.
// eslint-disable-next-line no-control-regex
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f-\u009f]/g;

/**
 * The title of an uploaded source: the client's file name without any path
 * segments, cleaned and shortened to `SOURCE_TITLE_MAX_LENGTH` characters
 * (PE-15). The name is untrusted input and is only ever used as a label,
 * never as a storage path.
 */
export function titleFromFilename(filename: string): string {
  // Browsers send the bare name, but some clients include a path with either separator.
  const name = filename.slice(Math.max(filename.lastIndexOf('/'), filename.lastIndexOf('\\')) + 1);
  const cleaned = name.replace(CONTROL_CHARACTERS, '').trim();
  if (cleaned.length === 0) {
    return FALLBACK_SOURCE_TITLE;
  }
  return truncate(cleaned, SOURCE_TITLE_MAX_LENGTH).trimEnd();
}

/**
 * Keeps at most `max` UTF-16 code units, the length the shared schemas count,
 * without splitting a character outside the BMP (e.g. an emoji) in half.
 */
function truncate(text: string, max: number): string {
  let result = '';
  for (const character of text) {
    if (result.length + character.length > max) {
      break;
    }
    result += character;
  }
  return result;
}
