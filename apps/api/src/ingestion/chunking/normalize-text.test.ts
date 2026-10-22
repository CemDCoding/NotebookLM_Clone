import { describe, expect, it } from 'vitest';
import { normalizeText } from './normalize-text';

describe('normalizeText', () => {
  it('composes decomposed umlauts into single characters', () => {
    const decomposed = 'Gro\u0308ße U\u0308bung';

    const normalized = normalizeText(decomposed);

    expect(normalized).toBe('Größe Übung');
    expect(normalized).toHaveLength(11);
  });

  it('unifies line breaks', () => {
    expect(normalizeText('eins\r\nzwei\rdrei')).toBe('eins\nzwei\ndrei');
  });

  it('collapses tabs, non-breaking and repeated spaces into one space', () => {
    expect(normalizeText('a\t\tb\u00A0\u00A0c   d\u2003e')).toBe('a b c d e');
  });

  it('replaces control characters and removes invisible ones', () => {
    expect(normalizeText('Wort\u0000ende Silben\u00ADtrennung null\u200Bbreite\uFEFF')).toBe(
      'Wort ende Silbentrennung nullbreite',
    );
  });

  it('trims every line and keeps single line breaks', () => {
    expect(normalizeText('  - Punkt eins  \n  - Punkt zwei  ')).toBe('- Punkt eins\n- Punkt zwei');
  });

  it('reduces runs of blank lines to one paragraph break', () => {
    expect(normalizeText('Absatz eins\n\n\n \n\nAbsatz zwei')).toBe('Absatz eins\n\nAbsatz zwei');
  });

  it('returns an empty string for whitespace only', () => {
    expect(normalizeText(' \n\t\r\n\u00A0 ')).toBe('');
  });
});
