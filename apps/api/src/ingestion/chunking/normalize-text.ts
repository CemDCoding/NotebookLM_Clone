// Characters that carry no visible text: soft hyphens left over from PDF
// hyphenation, zero-width spaces and joiners, and the byte order mark.
const INVISIBLE_CHARACTERS = /[\u00AD\u200B-\u200D\u2060\uFEFF]/g;

// C0 and C1 control characters except tab and line feed, which are whitespace
// and handled below. Carriage returns are converted before this runs.
// eslint-disable-next-line no-control-regex -- matching control characters is the point here
const CONTROL_CHARACTERS = /[\u0000-\u0008\u000B-\u001F\u007F-\u009F]/g;

// Every horizontal whitespace, including tabs and non-breaking spaces.
const HORIZONTAL_WHITESPACE = /[^\S\n]+/g;

/**
 * Normalizes extracted text before chunking, so chunk lengths reflect visible
 * text and embeddings are not skewed by layout artefacts.
 *
 * - Composes Unicode (NFC): PDFs often store "ä" as "a" plus a combining
 *   diaeresis, which would count as two characters and match worse.
 * - Unifies line breaks and removes control and invisible characters.
 * - Collapses horizontal whitespace to one space and trims every line.
 * - Keeps single line breaks (lists, tables in markdown) and reduces longer
 *   runs of blank lines to one, which marks a paragraph break.
 */
export function normalizeText(text: string): string {
  return text
    .normalize('NFC')
    .replace(/\r\n?/g, '\n')
    .replace(INVISIBLE_CHARACTERS, '')
    .replace(CONTROL_CHARACTERS, ' ')
    .replace(HORIZONTAL_WHITESPACE, ' ')
    .replace(/ ?\n ?/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
