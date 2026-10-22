import { describe, expect, it } from 'vitest';
import { buildSearchQuery } from './build-search-query';

describe('buildSearchQuery', () => {
  it('uses the question alone without a previous question', () => {
    expect(buildSearchQuery('Was ist RAG?')).toBe('Was ist RAG?');
  });

  it('puts the previous user question before the current one', () => {
    expect(buildSearchQuery('Und der zweite Punkt?', 'Welche Risiken nennt der Bericht?')).toBe(
      'Welche Risiken nennt der Bericht?\nUnd der zweite Punkt?',
    );
  });

  it('ignores an empty or blank previous question', () => {
    expect(buildSearchQuery('Was ist RAG?', '')).toBe('Was ist RAG?');
    expect(buildSearchQuery('Was ist RAG?', '   ')).toBe('Was ist RAG?');
  });

  it('does not repeat a question asked twice', () => {
    expect(buildSearchQuery('Was ist RAG?', ' Was ist RAG? ')).toBe('Was ist RAG?');
  });

  it('trims surrounding whitespace', () => {
    expect(buildSearchQuery('  Und weiter?\n', '\tWorum geht es? ')).toBe(
      'Worum geht es?\nUnd weiter?',
    );
  });
});
